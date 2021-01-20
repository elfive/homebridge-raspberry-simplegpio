'use strict';

let Service, Characteristic, api;

const packageConfig = require('./package.json');
const gpio = require('onoff').Gpio;
const { logEx, LOGLV_NONE, LOGLV_DEBUG, LOGLV_INFO, LOGLV_WARN, LOGLV_ERROR } = require('./log');

function PhysicToBCM(phy_pin) {
    const map = [
        null, null, 2, null, 3, null, 4, 14, null, 15,
        17, 18, 27, null, 22, 23, null, 24, 10, null,
        9, 25, 11, 8, null, 7, 0, 1, 5, null,
        6, 12, 13, null, 19, 16, 26, 20, null, 21];
    return map[phy_pin - 1];
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
        this.device = null;
        this.service = null;
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

    readStoragedConfigFromFile() {
        var result = {};
        try {
            const filePath = api.user.storagePath() + '/raspberry-simpleGPIO.json';
            if (fs.existsSync(filePath)) {
                const rawdata = fs.readFileSync(filePath);
                if (JSON.parse(rawdata)[this.config.name] !== undefined) {
                    result = JSON.parse(rawdata)[this.config.name];
                }
            }
        } catch (error) {
            this.log(LOGLV_ERROR, 'readstoragedConfigFromFile failed: ' + error);
        } finally {
            return result;
        }
    }

    saveStoragedConfigToFile(data) {
        var result = false;
        const filePath = api.user.storagePath() + '/raspberry-simpleGPIO.json';
        try {       // read
            if (fs.existsSync(filePath)) {
                const original_data = fs.readFileSync(filePath);
                result = JSON.parse(original_data);
            }
        } catch (error) {
            this.log(LOGLV_ERROR, 'readFileSync failed: ' + error);
        }

        try {       // write
            if (result && result[this.config.name] !== undefined) {
                result[this.config.name] = Object.assign(result[this.config.name], data)
            } else {
                result = {};
                result[this.config.name] = data;
            }
            const rawdata = JSON.stringify(result);
            fs.writeFileSync(filePath, rawdata);
            return true;
        } catch (error) {
            this.log(LOGLV_ERROR, 'saveStoragedConfigToFile failed: ' + error);
        }
    }

    // config usability check
    // return valid config or null
    configCheck(config) {
        config.name = getConfigValue(config.name, 'Raspberry-GPIO');

        if (null === PhysicToBCM(config.pin)) {
            this.log(LOGLV_ERROR, 'pin ' + config.pin + ' is not controllable.');
            return null;
        }

        config.reverse_status = getConfigValue(config.reverse_status, false);

        if (undefined === config.init_status) {
            config.init_status = 'off';
        } else if (config.init_status !== 'on' && config.init_status !== 'off') {
            this.log(LOGLV_ERROR, 'value of init_status can only be on or off.');
            return null;
        }
        
        config.log_level = getConfigValue(config.log_level, LOGLV_INFO);

        return config;
    }
    
    getInitPinStatusFromConfigure() {
        return (this.config.init_status === 'on' ? 1 : 0);
    }

    // return 0:OFF,1:ON
    convertPinStatusToOnOff(pinStatus) {
        return (pinStatus === 1);
    }

    // return 0:LOW,1:HIGH
    convertOnOffToPinStatus(onOrOFF) {
        return (onOrOFF ? 1 : 0);
    }

    create_service() {
        var gpio_options = {
            activeLow : this.config.reverse_status
        };

        const onGPIOValueChange = (device, service, characteristic) => {
            device.watch((err, value) => {
                if (err) {
                    this.log(LOGLV_ERROR, err);
                } else {
                    const status = this.convertPinStatusToOnOff(value);
                    service.setCharacteristic(characteristic, status);
                }
            });
        };

        const setupGPIOOutService = (constructor, characteristic, name, accessory_type, gpio_options) => {
            var service = null;
            if (gpio.accessible) {
                this.log(LOGLV_DEBUG, 'initializing accessory: ' + accessory_type);
            
                var service = null;
                const initPinStatus = this.getInitPinStatusFromConfigure();
                const initPinValue = initPinStatus === 1 ? (this.config.reverse_status ? 'low' : 'high') : (this.config.reverse_status ? 'high' : 'low');
                const device = new gpio(PhysicToBCM(this.config.pin), initPinValue, gpio_options);
                if (device) {
                    const status = this.convertPinStatusToOnOff(initPinStatus);
                    
                    service = new constructor(name);
                    service.setCharacteristic(characteristic, status);
                    service.getCharacteristic(characteristic)
                        .on('get', this.hb_get_status.bind(this))
                        .on('set', this.hb_set_status.bind(this));
                    
                    onGPIOValueChange(device, service, characteristic);
    
                    process.on('SIGINT', _ => {
                        this.log(LOGLV_INFO, 'uninitializing accesssory.');
                        device.unexport();
                    });
    
                    this.log(LOGLV_INFO, 'successfully initizlized accessory.');
    
                    this.device = device;
                } else {
                    this.log(LOGLV_DEBUG, 'unable to initialize accessory fan with gpio pin: ' + this.config.pin);
                }
            } else {
                this.log(LOGLV_DEBUG, 'current system not support gpio operations.');
            }

            return service;
        };

        const setupGPIOInService = (constructor, characteristic, name, accessory_type, gpio_options) => {
            this.log(LOGLV_DEBUG, 'initializing accessory: ' + accessory_type);
                
            var service = null;
            const initPinStatus = this.getInitPinStatusFromConfigure();
            const device = new gpio(PhysicToBCM(this.config.pin), 'in', 'both', gpio_options);
            if (device) {
                const status = this.convertPinStatusToOnOff(initPinStatus);
                
                service = new constructor(name);
                service.setCharacteristic(characteristic, status);
                service.getCharacteristic(characteristic)
                    .on('get', this.hb_get_status.bind(this));
                
                onGPIOValueChange(device, service, characteristic);
                this.log(LOGLV_INFO, 'successfully initizlized accessory.');

                this.device = device;
            } else {
                this.log(LOGLV_DEBUG, 'unable to initialize accessory contact_sensor with gpio pin: ' + this.config.pin);
            }
            return service;
        };

        var service = null;
        switch (this.config.accessory_type) {
            case 'fan':
                service = setupGPIOOutService(
                    Service.Fan,
                    Characteristic.On,
                    this.config.name,
                    'fan',
                    gpio_options);
                break;
            case 'outlet':
                service = setupGPIOOutService(
                    Service.Outlet,
                    Characteristic.On,
                    this.config.name,
                    'outlet',
                    gpio_options);
                break;
            case 'switch':
                service = setupGPIOOutService(
                    Service.Switch,
                    Characteristic.On,
                    this.config.name,
                    'switch',
                    gpio_options);
                break;
            case 'contact_sensor':
                service = setupGPIOInService(
                    Service.ContactSensor,
                    Characteristic.ContactSensorState,
                    this.config.name,
                    'contact_sensor',
                    gpio_options);
                break;
            case 'leak_sensor':
                service = setupGPIOInService(
                    Service.LeakSensor,
                    Characteristic.LeakDetected,
                    this.config.name,
                    'leak_sensor',
                    gpio_options);
                break;
            case 'motion_sensor':
                service = setupGPIOInService(
                    Service.MotionSensor,
                    Characteristic.MotionDetected,
                    this.config.name,
                    'motion_sensor',
                    gpio_options);
                break;
            case 'occupancy_sensor':
                service = setupGPIOInService(
                    Service.OccupancySensor,
                    Characteristic.OccupancyDetected,
                    this.config.name,
                    'occupancy_sensor',
                    gpio_options);
                break;
            case 'smoke_sensor':
                service = setupGPIOInService(
                    Service.SmokeSensor,
                    Characteristic.SmokeDetected,
                    this.config.name,
                    'smoke_sensor',
                    gpio_options);
                break;
            default:
                this.log(LOGLV_WARN, 'unsupported accessory: ' + this.config.accessory_type + ', using switch instead');
                this.config.accessory_type = 'switch';
                service = setupGPIOOutService(
                    Service.Switch,
                    Characteristic.On,
                    this.config.name,
                    'switch',
                    gpio_options);
        }

        return service;
    }

    hb_get_status(callback) {
        this.device.read((err, value) => {
            if (err) {
                this.log(LOGLV_ERROR, 'get accessory status error: ' + err);
            } else {
                callback(null, value);
            }
        });
    }

    hb_set_status(value, callback) {
        this.device.write(value ? 1 : 0, (err) => {
            if (err) {
                this.log(LOGLV_ERROR, 'set accessory status error: ' + err);
            }
            callback(null);
        });
    }
}

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    api = homebridge;
    homebridge.registerAccessory('homebridge-raspberry-simpleGPIO', 'raspberry_simple_gpio', raspberry_simple_gpio_plugin);
}