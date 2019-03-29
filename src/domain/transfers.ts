/**
 * Created by pedrosousabarreto@gmail.com on 31/Jan/2019.
 */


"use strict";

import * as assert from "assert";
import * as async from "async";
import uuid = require("uuid");
import * as BaseJoi from "joi";

const JoiCurrencyCode = require("joi-currency-code")(BaseJoi);
const DateExtension = require("joi-date-extensions");
const Joi = JoiCurrencyCode.extend(DateExtension);

import {IDiFactory, ILogger, ServiceConfigs} from "node-microsvc-lib";
import {KafkaProducer} from "../infra_libs/kafka_producer";
import {IEventStoreMessage} from "../infra_libs/kafka_messages";

export class TransfersAdapter implements IDiFactory {
	private _name = "TransfersAdapter";
	private _configs: ServiceConfigs;
	private _logger: ILogger;
	private _kafka_producer!: KafkaProducer;
	private _position_cmds_topic!: string;

	get name() {
		return this._name;
	};

	constructor(configs: ServiceConfigs, logger: ILogger) {
		this._configs = configs;
		this._logger = logger;

		assert.ok(configs.get_param_value("kafka_conn_string"));
		assert.ok(configs.get_param_value("position_cmds_topic"));
	}

	init(callback: (err?: Error) => void) {
		this._logger.info("%s initialising...", this.name);

		let kafka_conn_string = this._configs.get_param_value("kafka_conn_string");
		this._position_cmds_topic = this._configs.get_param_value("position_cmds_topic");

		this._kafka_producer = new KafkaProducer(
			kafka_conn_string,
			this._configs.instance_id,
			this._configs.env,
			this._logger
		);


		// @ts-ignore
		async.parallel([
			this._kafka_producer.init.bind(this._kafka_producer),
		], (err?: Error) => {
			if (err)
				this._logger.error(err, "error initializing");
			else
				this._logger.info("initialized");
			callback(err);
		});
	}

	destroy(callback: () => void) {
		this._logger.info("%s - destroying...", this.name);
		callback();
	}

	prepare(headers: any, message: any, callback: (err?: Error) => void) {
		// this._logger.debug('domain::transfer::prepare::start(%s, %s)', headers, message);

		// validate
		const val_error = this._validate_prepare(headers, message);
		if (val_error)
			return callback(val_error);

		const messageProtocol = {
			id: message.transferId,
			to: message.payeeFsp,
			from: message.payerFsp,
			type: 'application/json',
			content: {
				headers: headers,
				payload: message
			},
			metadata: {
				event: {
					id: uuid.v4(),
					type: 'prepare',
					action: 'prepare',
					createdAt: new Date(),
					state: {
						status: 'success',
						code: 0
					}
				}
			}
		};

		const msg: IEventStoreMessage = {
			header: {
				msg_id: uuid.v4(),
				msg_schema_name: "PrepareTransfer",
				msg_schema_version: 1,
				msg_topic: this._position_cmds_topic,
				msg_key: message.payerFsp, // review
				correlation_id: "nothing yet",
				entity_id: message.transferId,
				entity_version: 0,
				msg_timestamp: Date.now(),
				source_system_instance_id: this._configs.instance_id,
				source_system_name: this._configs.instance_name
			},
			payload: messageProtocol
		};

		this._kafka_producer.send(msg, (err, offset_data) => {
			return callback(err);
		});
	}


	private _validate_prepare(headers: any, message: any): Error {

		const headers_schema = Joi.object({
			headers: {
				'accept': Joi.string().optional().regex(/application\/vnd.interoperability[.]/),
				'content-type': Joi.string().required().regex(/application\/vnd.interoperability[.]/),
				'content-length': Joi.number().max(5242880),
				'date': Joi.date().format('ddd, D MMM YYYY H:mm:ss [GMT]').required(),
				'x-forwarded-for': Joi.string().optional(),
				'fspiop-source': Joi.string().required(),
				'fspiop-destination': Joi.string().optional(),
				'fspiop-encryption': Joi.string().optional(),
				'fspiop-signature': Joi.string().optional(),
				'fspiop-uri': Joi.string().optional(),
				'fspiop-http-method': Joi.string().optional()
			},
			message: {
				transferId: Joi.string().guid().required().description('Id of transfer').label('@ Transfer Id must be in a valid GUID format. @'),
				payeeFsp: Joi.string().required().min(1).max(32).description('Financial Service Provider of Payee').label('@ A valid Payee FSP number must be supplied. @'),
				payerFsp: Joi.string().required().min(1).max(32).description('Financial Service Provider of Payer').label('@ A valid Payer FSP number must be supplied. @'),
				amount: Joi.object().keys({
					currency: Joi.string().required().currency().description('Currency of the transfer').label('@ Currency needs to be a valid ISO 4217 currency code. @'),
					amount: Joi.string().required().regex(/^([0]|([1-9][0-9]{0,17}))([.][0-9]{0,3}[1-9])?$/).description('Amount of the transfer')
				}).required().description('Amount of the transfer').label('@ Supplied amount fails to match the required format. @'),
				ilpPacket: Joi.string().required().regex(/^[A-Za-z0-9-_]+[=]{0,2}$/).min(1).max(32768).description('ilp packet').label('@ Supplied ILPPacket fails to match the required format. @'),
				condition: Joi.string().required().trim().max(48).regex(/^[A-Za-z0-9-_]{43}$/).description('Condition of transfer').label('@ A valid transfer condition must be supplied. @'),
				expiration: Joi.string().required().regex(/^(?:[1-9]\d{3}-(?:(?:0[1-9]|1[0-2])-(?:0[1-9]|1\d|2[0-8])|(?:0[13-9]|1[0-2])-(?:29|30)|(?:0[13578]|1[02])-31)|(?:[1-9]\d(?:0[48]|[2468][048]|[13579][26])|(?:[2468][048]|[13579][26])00)-02-29)T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:(\.\d{3}))(?:Z|[+-][01]\d:[0-5]\d)$/).description('When the transfer expires').label('@ A valid transfer expiry date must be supplied. @'),
				extensionList: Joi.object().keys({
					extension: Joi.array().items(Joi.object().keys({
						key: Joi.string().required().min(1).max(32).description('Key').label('@ Supplied key fails to match the required format. @'),
						value: Joi.string().required().min(1).max(128).description('Value').label('@ Supplied key value fails to match the required format. @')
					})).required().min(1).max(16).description('extension')
				})
			}
		}).unknown(false).options({stripUnknown: true});

		const result = Joi.validate({headers, message}, headers_schema);

		return result.error;
	}

}