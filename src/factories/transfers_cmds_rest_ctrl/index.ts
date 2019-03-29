/**
 * Created by pedrosousabarreto@gmail.com on 15/Jan/2019.
 */


"use strict";

import * as assert from "assert";
import * as url from "url";
import * as async from "async";
import * as express from "express";
import * as body_parser from "body-parser";

import {ILogger, IDiFactory, ServiceConfigs} from "node-microsvc-lib";
import {TransfersAdapter} from "../../domain/transfers";
import {Metrics} from "../metrics";
import {Histogram} from "prom-client";


const my_path = "/transfers";

export class TransferCmdsRestCtrl implements IDiFactory {
	private _name = "TransferCmdsRestCtrl";
	private _configs: ServiceConfigs;
	private _express_app: express.Application;

	private _logger: ILogger;
	private _transfers: TransfersAdapter;
	private _metrics:Metrics;
	private _pos_trans_hist!:Histogram;

	get name() {
		return this._name;
	};

	constructor(configs: ServiceConfigs, express_app: express.Application, logger: ILogger, transfers_adapter: TransfersAdapter, metrics: Metrics) {
		this._configs = configs;
		this._express_app = express_app;
		this._logger = logger.create_child({component: this.name});

		this._metrics = metrics;
		this._transfers = transfers_adapter;
		// check all necessary configs are available
		// assert.ok(configs.get_param_value("ext_base_url"));
	}

	init(callback: (err?: Error) => void) {
		this._logger.info("%s initialising factory: %s ...", this.name);

		// @ts-ignore
		async.parallel([
			this._transfers.init.bind(this._transfers),
			this._inject_routes.bind(this),
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

		setImmediate(() => {
			callback();
		});
		// use async.parallel or sequence for multiple initializations
	}

	private _inject_routes(callback: (err?: Error) => void) {
		this._logger.info("initialising routes...");

		let router = express.Router();

		router.use(body_parser.json({ type: "application/*" }));

		router.get("/:id", this._handler_get.bind(this));
		router.post("/", this._handler_post.bind(this));
		router.put("/:id", this._handler_put.bind(this));

		const router_path = url.resolve(this._configs.app_base_url, my_path);
		this._express_app.use(router_path, router);

		this._logger.info(`routes injected at ${router_path}`);

		callback()
	}

	/*
	private _request_middleware_example(req: express.Request, res: express.Response, next: express.NextFunction) {

		next();
	}
	*/

	/****************************************************
	 * handlers
	 ****************************************************/

	private _handler_get(req: express.Request, res: express.Response, next: express.NextFunction) {

		return res.send({
			correlation_id: res.locals["correlation_id"],
			service: this.name,
			id: req.params["id"]
		});

	}

	private _handler_post(req: express.Request, res: express.Response, next: express.NextFunction) {
		if(!this._pos_trans_hist)
			this._pos_trans_hist = this._metrics.get_histogram("transfer_prepare_ms");

		const end_fn = this._pos_trans_hist.startTimer();

		this._transfers.prepare(req.headers, req.body, (err) => {
			if(err){
				return res.status(400).send({
					errors: [err]
				});
			}

			// capture time taken in secs with ms precision
			end_fn();

			return res.send({
				correlation_id: res.locals["correlation_id"], // this comes from the framework
				service: this.name,
				id: req.params["id"]
			});
		});


	}

	private _handler_put(req: express.Request, res: express.Response, next: express.NextFunction) {

		return res.send({
			correlation_id: res.locals["correlation_id"],
			service: this.name
		});

	}


}
