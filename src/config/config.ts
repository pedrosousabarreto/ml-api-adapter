/**
 * Created by pedrosousabarreto@gmail.com on 15/Jan/2019.
 */
"use strict";

import {ServiceConfigs, AppBaseConfigs} from "node-microsvc-lib";

let app_base_confs = new AppBaseConfigs();
app_base_confs.env = process.env.NODE_ENV || 'dev_local';
app_base_confs.solution_name = "mojaloop";
app_base_confs.app_name = "ml-api-adapter";
app_base_confs.app_version = "0.0.1";
app_base_confs.app_api_prefix = "";
app_base_confs.app_api_version = "1";

// First load the required params with their default values
import svc_params = require("./params");
// check if overrides is enabled and an override file exists and if so, apply it
svc_params.override_from_env_file(app_base_confs);


// exports a ServiceConfigs instance
export = new ServiceConfigs(svc_params, null, app_base_confs);