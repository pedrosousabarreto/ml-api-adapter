/**
 * Created by pedrosousabarreto@gmail.com on 15/Jan/2019.
 */
"use strict";
const start_time = Date.now();

import {Microservice, ConsoleLogger} from "node-microsvc-lib";

// factories/modules
import {RequestLogger} from "./factories/request_logger";
import {HealthCheck} from "./factories/health_check";
import {TransferCmdsRestCtrl} from "./factories/transfers_cmds_rest_ctrl";
import {Metrics} from "./factories/metrics";
import {TransfersAdapter} from "./domain/transfers";

import configs = require("./config/config");

const logger = new ConsoleLogger();

// create microservice app, no init yet
const app = new Microservice(configs, logger);

app.register_dependency("logger", logger);

// register factories, order matters
app.register_factory("request_logger", RequestLogger);
app.register_factory("metrics", Metrics);
app.register_factory("transfers_adapter", TransfersAdapter);
app.register_factory("transfers_cmds_rest_ctrl", TransferCmdsRestCtrl);
app.register_factory("health_check", HealthCheck);


process.on("uncaughtException", (err:Error)=>{
	logger.fatal(err);
});

app.init((err?: Error) => {
	if (err)
		return console.error(err);

	logger.info("APP STARTED - took %d ms", Date.now()-start_time);
});
