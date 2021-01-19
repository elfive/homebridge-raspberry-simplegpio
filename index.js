'use strict';

let Service, Characteristic, api;
let SupportServiceType = [];

const packageConfig = require('./package.json');
const gpio = require('rpi-gpio');
const { logEx, LOGLV_NONE, LOGLV_DEBUG, LOGLV_INFO, LOGLV_WARN, LOGLV_ERROR } = require('./log');

function getConstructor(type) {
    const object = SupportServiceType.find((element => element.type == type));
    if (object === undefined) {
        return {type: 'switch', constructor: Service.Switch};
    } else {
        return object;
    }
}

function checkValueRange(value, min, max) {
    return value >= min && value <= max;
}

function getConfigValue(original, default_value) {
    return (original !== undefined ? original : default_value);
}

class raspberry_simple_gpio_plugin {
    constructor(log, config) {
        this.log = new logEx(log, getConfigValue(config.log_level, LOGLV_INFO)).log;
        this.config = config;
        this.services = [];
        
        this.status = false;

        // function
        this.accessory_update_status = (status) => this.log(LOGLV_ERROR, 'can not update senser status yet.');
    }

    getServices() {
        // check config usability
        this.log(LOGLV_DEBUG, 'check config usability...');
        this.config = this.configCheck(this.config)
        if (!this.config) {
            this.log(LOGLV_ERROR, 'config usability check failed.');
            return this.services;
        }
        this.log(LOGLV_DEBUG, 'config usability check passed.');

        // create_service
        const service = this.create_service();
        if (!service) {
            return [];
        }
        this.services.push(service);

        // divice information
        this.info_service = new Service.AccessoryInformation();
        this.info_service
            .setCharacteristic(Characteristic.Identify, packageConfig.name)
            .setCharacteristic(Characteristic.Manufacturer, (packageConfig.author.name !== undefined ? packageConfig.author.name : 'elfive@elfive.cn'))
            .setCharacteristic(Characteristic.Model, packageConfig.name)
            .setCharacteristic(Characteristic.SerialNumber, packageConfig.version)
            .setCharacteristic(Characteristic.Name, this.config.name)
            .setCharacteristic(Characteristic.FirmwareRevision, packageConfig.version);
        this.services.push(this.info_service);

        return this.services;
    }

    // config usability check
    // return valid config or null
    configCheck(config) {
        return config;
    }

    create_service() {
        var service = null;
        switch (this.config.type) {
            case 'fan':
                this.log(LOGLV_DEBUG, 'initializing accessory: fan');
                service = new Service.Fan(this.config.name, this.config.name);
                service.setCharacteristic(Characteristic.On, false);
                service.getCharacteristic(Characteristic.On)
                    .on('get', this.hb_get_status.bind(this))
                    .on('set', this.hb_set_status.bind(this));

                // gpio
                gpio.setup(this.config.pin, gpio.DIR_OUT, (status) => {
                    this.status = status;
                    service.setCharacteristic(Characteristic.On, status);
                });
                break;
            case 'outlet':
                this.log(LOGLV_DEBUG, 'initializing accessory: outlet');
                service = new Service.Outlet(this.config.name, this.config.name);
                service.setCharacteristic(Characteristic.On, false);
                service.getCharacteristic(Characteristic.On)
                    .on('get', this.hb_get_status.bind(this))
                    .on('set', this.hb_set_status.bind(this));
                
                // gpio
                gpio.setup(this.config.pin, gpio.DIR_OUT, (status) => {
                    this.status = status;
                    service.setCharacteristic(Characteristic.On, status);
                });
                break;
            case 'switch':
                this.log(LOGLV_DEBUG, 'initializing accessory: switch');
                service = new Service.Switch(this.config.name, this.config.name);
                service.setCharacteristic(Characteristic.On, false);
                service.getCharacteristic(Characteristic.On)
                    .on('get', this.hb_get_status.bind(this))
                    .on('set', this.hb_set_status.bind(this));
                
                // gpio
                gpio.setup(this.config.pin, gpio.DIR_OUT, (status) => {
                    this.status = status;
                    service.setCharacteristic(Characteristic.On, status);
                });
                break;
            case 'contact_sensor':
                this.log(LOGLV_DEBUG, 'initializing accessory: contact_sensor');
                service = new Service.ContactSensor(this.config.name, this.config.name);
                service.setCharacteristic(Characteristic.ContactSensorState, false);
                service.getCharacteristic(Characteristic.ContactSensorState)
                    .on('get', this.hb_get_status.bind(this));
                
                // gpio
                gpio.setup(this.config.pin, gpio.DIR_IN, (status) => {
                    this.status = status;
                    service.setCharacteristic(Characteristic.ContactSensorState, status);
                });
                break;
            case 'leak_sensor':
                this.log(LOGLV_DEBUG, 'initializing accessory: leak_sensor');
                service = new Service.LeakSensor(this.config.name, this.config.name);
                service.setCharacteristic(Characteristic.LeakDetected, false);
                service.getCharacteristic(Characteristic.LeakDetected)
                    .on('get', this.hb_get_status.bind(this));
                
                // gpio
                gpio.setup(this.config.pin, gpio.DIR_IN, (status) => {
                    this.status = status;
                    service.setCharacteristic(Characteristic.LeakDetected, status);
                });
                break;
            case 'motion_sensor':
                this.log(LOGLV_DEBUG, 'initializing accessory: motion_sensor');
                service = new Service.MotionSensor(this.config.name, this.config.name);
                service.setCharacteristic(Characteristic.MotionDetected, false);
                service.getCharacteristic(Characteristic.MotionDetected)
                    .on('get', this.hb_get_status.bind(this));
                
                // gpio
                gpio.setup(this.config.pin, gpio.DIR_IN, (status) => {
                    this.status = status;
                    service.setCharacteristic(Characteristic.MotionDetected, status);
                });
                break;
            case 'occupancy_sensor':
                this.log(LOGLV_DEBUG, 'initializing accessory: occupancy_sensor');
                service = new Service.OccupancySensor(this.config.name, this.config.name);
                service.setCharacteristic(Characteristic.On, false);
                service.getCharacteristic(Characteristic.On)
                    .on('get', this.hb_get_status.bind(this));
                
                // gpio
                gpio.setup(this.config.pin, gpio.DIR_IN, (status) => {
                    this.status = status;
                    service.setCharacteristic(Characteristic.OccupancyDetected, status);
                });
                break;
            case 'smoke_sensor':
                this.log(LOGLV_DEBUG, 'initializing accessory: smoke_sensor');
                service = new Service.SmokeSensor(this.config.name, this.config.name);
                service.setCharacteristic(Characteristic.SmokeDetected, false);
                service.getCharacteristic(Characteristic.SmokeDetected)
                    .on('get', this.hb_get_status.bind(this));
                
                // gpio
                gpio.setup(this.config.pin, gpio.DIR_IN, (status) => {
                    this.status = status;
                    service.setCharacteristic(Characteristic.SmokeDetected, status);
                });
                break;
            default:
                this.log(LOGLV_WARN, 'unsupported accessory: ' + this.config.type + ', using switch instead');
                this.config.type = 'switch';
                this.log(LOGLV_DEBUG, 'initializing accessory: switch');
                service = new Service.Switch(this.config.name, this.config.name);
                service.setCharacteristic(Characteristic.On, false);
                service.getCharacteristic(Characteristic.On)
                    .on('get', this.hb_get_status.bind(this))
                    .on('set', this.hb_set_status.bind(this));
                
                // gpio
                gpio.setup(this.config.pin, gpio.DIR_OUT, (status) => {
                    this.status = status;
                    service.setCharacteristic(Characteristic.On, status);
                });
        }

        return service;
    }

    hb_get_status(callback) {
        callback(null, this.state);
    }

    hb_set_status(value, callback) {
        this.state = value;
        callback(null);
    }
}

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    api = homebridge;

    // add supported services
    SupportServiceType.push({type: 'fan', constructor: Service.Fan, characteristic: Characteristic.On});
    SupportServiceType.push({type: 'outlet', constructor: Service.Outlet});
    SupportServiceType.push({type: 'switch', constructor: Service.Switch});
    SupportServiceType.push({type: 'contact_sensor', constructor: Service.ContactSensor});
    SupportServiceType.push({type: 'leak_sensor', constructor: Service.LeakSensor});
    SupportServiceType.push({type: 'motion_sensor', constructor: Service.MotionSensor});
    SupportServiceType.push({type: 'occupancy_sensor', constructor: Service.OccupancySensor});
    SupportServiceType.push({type: 'smoke_sensor', constructor: Service.SmokeSensor});

    homebridge.registerAccessory('homebridge-raspberry-simpleGPIO', 'raspberry_simple_gpio', raspberry_simple_gpio_plugin);
}