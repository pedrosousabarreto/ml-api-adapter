/**
 * Created by pedrosousabarreto@gmail.com on 15/Jan/2019.
 */
"use strict";
import * as express from "express";
import {ILogger,IDiFactory, ServiceConfigs} from "node-microsvc-lib";

const zipkin = require("zipkin");
const CLSContext = require("zipkin-context-cls");
const ctxImpl = new CLSContext(); // if you want to use CLS
const xtxImpl = new zipkin.ExplicitContext(); // Alternative; if you want to pass around the context manually

const zipkinMiddleware = require("zipkin-instrumentation-express").expressMiddleware;
const {HttpLogger} = require("zipkin-transport-http");

export class RequestLogger implements IDiFactory {
	private _name = "RequestLogger";
	private _configs: ServiceConfigs;
	private _express_app: express.Application;

	private _logger: ILogger;
	private _tracer: any;

	get name() {
		return this._name;
	};

	constructor(configs: ServiceConfigs, express_app: express.Application, logger:ILogger) {
		this._configs = configs;
		this._express_app = express_app;
		this._logger = logger;


		const ctxImpl = new CLSContext();

		const recorder = new zipkin.BatchRecorder({
			logger: new HttpLogger({
				endpoint: `http://localhost:9411/api/v1/spans`
			})
		});

		this._tracer = new zipkin.Tracer({
			ctxImpl,
			recorder: recorder, //new zipkin.ConsoleRecorder(), // For easy debugging. You probably want to use an actual implementation, like Kafka or Scribe.
			// sampler: new zipkin.sampler.CountingSampler(0.01), // sample rate 0.01 will sample 1 % of all incoming requests
			traceId128Bit: true, // to generate 128-bit trace IDs. 64-bit (false) is default
			localServiceName: this._configs.app_name // indicates this node in your service graph
		});
	}

	init(callback: (err?: Error) => void) {
		this._logger.info("%s initialising...", this.name);

		this._inject_routes((err?:Error)=>{
			if(err) {
				this._logger.error(err, this.name+" Error initializing");
				return callback(err);
			}

			this._logger.info("%s initialised", this.name);
			callback();
		});
	}

	destroy(callback:()=>void){
		this._logger.info("%s - destroying...", this.name);
		callback();
	}

	private _inject_routes(callback: (err?: Error) => void) {
		this._logger.info("%s initialising routes...", this.name);

		// this._express_app.use(bunyan_middleware({
		// 	headerName: 'X-Request-Id'
		// 	, propertyName: 'req_id'
		// 	, logName: 'req_id'
		// 	, obscureHeaders: []
		// 	, logger: this._logger
		// }));

		// simple logger
		this._express_app.use((req:express.Request, res:express.Response, next:express.NextFunction)=>{
			setImmediate(()=>{
				this._logger.info(`${new Date().toISOString()} - ${this._name} - ${req.method} - ${req.url}`);
			});

			next();
		});

		// zipkin distributed tracing
		this._express_app.use(zipkinMiddleware({
			tracer: this._tracer,
			serviceName: 'service_1' // name of this application
		}));

		// respond immediately - this is being called from some init() fn
		callback(undefined)
	}

}
