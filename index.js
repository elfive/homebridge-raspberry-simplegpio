'use strict';

let PlatformAccessory, Accessory, Service, Characteristic, UUIDGen;

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
class raspberry_simple_gpio {
    constructor(log, config, api) {
        this.log = new logEx(log, getConfigValue(config.log_level, LOGLV_INFO)).log;

        if (null === api) {
            this.log(LOGLV_ERROR, "Homebridge's version is too old, please upgrade!");
            return;
        }
        
        if (null === config) {
            return;
        }
        this.config = config;
        this.api = api;
        this.accessories = new Map();

        // Listen to event "didFinishLaunching", this means homebridge already finished loading cached accessories.
        // Platform Plugin should only register new accessory that doesn't exist in homebridge after this event.
        // Or start discover new accessories.
        this.api.on('didFinishLaunching', () => {
            this.log(LOGLV_INFO, 'Initializing Raspberry Pi GPIO devices');
            // check config usability
            this.config.devices.forEach((device_config) => {
                const config = this.configDeviceCheck(device_config);
                if (config) {
                    this.initializeAccessory(config);
                }
            });
        });
        this.log(LOGLV_INFO, 'Platform Plugin Loaded');
    }

    // REQUIRED - Homebridge will call the "configureAccessory" method once for every cached accessory restored
    configureAccessory(accessory) {
        this.log(LOGLV_INFO, 'Configuring cached accessory: [' + accessory.displayName + '] ' + ' ' + accessory.UUID + '');
        this.accessories.set(accessory.UUID, accessory);
    }
    
    getInitPinStatusFromConfigure(config) {
        return (config.init_status === 'on' ? 1 : 0);
    }

    // return 0:OFF,1:ON
    convertPinStatusToOnOff(pinStatus) {
        return (pinStatus === 1);
    }

    // return 0:LOW,1:HIGH
    convertOnOffToPinStatus(onOrOFF) {
        return (onOrOFF ? 1 : 0);
    }

    setupGPIOService(gpio_service, info_service, config) {
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

        const setupGPIOInfoService = () => {
            info_service = new Service.AccessoryInformation();
            if (info_service) {
                info_service
                    .setCharacteristic(Characteristic.Identify, packageConfig.name)
                    .setCharacteristic(Characteristic.Manufacturer, (packageConfig.author.name !== undefined ? packageConfig.author.name : 'elfive@elfive.cn'))
                    .setCharacteristic(Characteristic.Model, packageConfig.name)
                    .setCharacteristic(Characteristic.SerialNumber, packageConfig.version)
                    .setCharacteristic(Characteristic.Name, config.name)
                    .setCharacteristic(Characteristic.FirmwareRevision, packageConfig.version);
                return true;
            } else {
                return false;
            }
        };

        const setupGPIOOutService = (characteristic, accessory_type, gpio_options) => {
            this.log(LOGLV_DEBUG, 'initializing accessory : ' + config.name);

            const initPinStatus = this.getInitPinStatusFromConfigure(config);
            const initPinValue = initPinStatus === 1 ? (config.reverse_status ? 'low' : 'high') : (config.reverse_status ? 'high' : 'low');
            const gpio_device = new gpio(PhysicToBCM(config.pin), initPinValue, gpio_options);
            if (gpio_device) {
                gpio_service.setCharacteristic(Characteristic.Name, config.name);
                gpio_service.setCharacteristic(characteristic, this.convertPinStatusToOnOff(initPinStatus));
                gpio_service.getCharacteristic(characteristic)
                    .on('get', this.hb_get_status.bind(this, gpio_device))
                    .on('set', this.hb_set_status.bind(this, gpio_device));
                
                onGPIOValueChange(gpio_device, gpio_service, characteristic);

                process.on('SIGINT', _ => {
                    this.log(LOGLV_DEBUG, 'uninitializing accesssory: ' + config.name);
                    gpio_device.unexport();
                });

                this.log(LOGLV_INFO, 'successfully initizlized accessory: ' + config.name);
                return true;
            } else {
                this.log(LOGLV_ERROR, 'unable to initialize accessory: ' + config.name);
            }
            return false;
        };

        const setupGPIOInService = (characteristic, accessory_type, gpio_options) => {
            this.log(LOGLV_DEBUG, 'initializing accessory : ' + config.name);
                
            const initPinStatus = this.getInitPinStatusFromConfigure(config);
            const device = new gpio(PhysicToBCM(config.pin), 'in', 'both', gpio_options);
            if (device) {
                gpio_service.setCharacteristic(Characteristic.Name, config.name);
                gpio_service.setCharacteristic(characteristic, this.convertPinStatusToOnOff(initPinStatus));
                gpio_service.getCharacteristic(characteristic)
                    .on('get', this.hb_get_status.bind(this, device));
                
                onGPIOValueChange(device, gpio_service, characteristic);
                        
                process.on('SIGINT', _ => {
                    this.log(LOGLV_DEBUG, 'uninitializing accesssory: ' + config.name);
                    gpio_device.unexport();
                });

                this.log(LOGLV_INFO, 'successfully initizlized accessory: ' + config.name);
                return true;
            } else {
                this.log(LOGLV_ERROR, 'unable to initialize accessory: ' + config.name);
            }
            return false;
        };

        var gpio_options = {
            activeLow : config.reverse_status
        };

        if (gpio.accessible) {
            // setup gpio_service
            switch (config.accessory_type) {
                case 'fan':
                    return setupGPIOOutService(Characteristic.On, 'fan', gpio_options) &&
                        setupGPIOInfoService();
                case 'outlet':
                    return setupGPIOOutService(Characteristic.On, 'outlet', gpio_options) &&
                        setupGPIOInfoService();
                case 'switch':
                    return setupGPIOOutService(Characteristic.On, 'switch', gpio_options) && 
                        setupGPIOInfoService();
                case 'contact_sensor':
                    return setupGPIOInService(Characteristic.ContactSensorState, 'contact_sensor', gpio_options) &&
                        setupGPIOInfoService();
                case 'leak_sensor':
                    return setupGPIOInService(Characteristic.LeakDetected, 'leak_sensor', gpio_options) &&
                        setupGPIOInfoService();
                case 'motion_sensor':
                    return setupGPIOInService(Characteristic.MotionDetected, 'motion_sensor', gpio_options) &&
                        setupGPIOInfoService();
                case 'occupancy_sensor':
                    return setupGPIOInService(Characteristic.OccupancyDetected, 'occupancy_sensor', gpio_options) &&
                        setupGPIOInfoService();
                case 'smoke_sensor':
                    return setupGPIOInService(Characteristic.SmokeDetected, 'smoke_sensor', gpio_options) &&
                        setupGPIOInfoService();
                default:
                    this.log(LOGLV_WARN, 'unsupported accessory: ' + config.accessory_type);
            }
        } else {
            this.log(LOGLV_DEBUG, 'current system not support gpio operations.');
        }
        return false;
    }

    initializeAccessory(config) {
        this.log(LOGLV_DEBUG, 'initialize accessory: ' + config.name + ' (' + config.accessory_type + ')');

        const uuid = UUIDGen.generate(config.name);
        let accessory = this.accessories.get(uuid);

        if (!accessory) {
            // accessory not exists, create accessory
            accessory = new this.api.platformAccessory(config.name, uuid, config.name);
            this.api.registerPlatformAccessories('homebridge-raspberry-simpleGPIO', 'raspberry_simple_gpio', [accessory]);
        }

        let gpio_service = accessory.getService(config.name);
        if (!gpio_service) {
            // service not exist, create service
            switch (config.accessory_type) {
                case 'fan':
                    gpio_service = accessory.addService(Service.Fan, config.name, config.name);
                    break;
                case 'outlet':
                    gpio_service = accessory.addService(Service.Outlet, config.name, config.name);
                    break;
                case 'switch':
                    gpio_service = accessory.addService(Service.Switch, config.name, config.name);
                    break;
                case 'contact_sensor':
                    gpio_service = accessory.addService(Service.ContactSensor, config.name, config.name);
                    break;
                case 'leak_sensor':
                    gpio_service = accessory.addService(Service.LeakSensor, config.name, config.name);
                    break;
                case 'motion_sensor':
                    gpio_service = accessory.addService(Service.MotionSensor, config.name, config.name);
                    break;
                case 'occupancy_sensor':
                    gpio_service = accessory.addService(Service.OccupancySensor, config.name, config.name);
                    break;
                case 'smoke_sensor':
                    gpio_service = accessory.addService(Service.SmokeSensor, config.name, config.name);
                    break;
                default:
                    this.log(LOGLV_WARN, 'unsupported accessory: ' + config.accessory_type + ', using switch instead');
                    config.accessory_type = 'switch';
                    gpio_service = accessory.addService(Service.Switch, config.name, config.name);
            }
            if (!gpio_service) {
                this.log(LOGLV_ERROR, 'accessory service create failed.');
                return;
            }
        }

        let info_service = accessory.getService(config.name);
        if (!info_service) {
            info_service = accessory.addService(Service.AccessoryInformation, config.name, config.name);
        }

        if (this.setupGPIOService(gpio_service, info_service, config)) {
            // Add to registered accessories
            this.log(LOGLV_DEBUG, 'Register PlatformAccessory: (' + accessory.displayName + ')');
            this.accessories.set(uuid, accessory);
        } else {
            this.log(LOGLV_ERROR, 'accessory service setup failed.');
        }
    }

    // config usability check
    // return valid config or null
    configDeviceCheck(config) {
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
        return config;
    }

    hb_get_status(device, callback) {
        device.read((err, value) => {
            if (err) {
                this.log(LOGLV_ERROR, 'get accessory status error: ' + err);
            } else {
                callback(null, value);
            }
        });
    }

    hb_set_status(device, value, callback) {
        device.write(value ? 1 : 0, (err) => {
            if (err) {
                this.log(LOGLV_ERROR, 'set accessory status error: ' + err);
            }
            callback(null);
        });
    }
}

module.exports = function (homebridge) {
    PlatformAccessory = homebridge.platformAccessory;
    Accessory = homebridge.hap.Accessory;
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    UUIDGen = homebridge.hap.uuid;

    homebridge.registerPlatform('homebridge-raspberry-simpleGPIO', 'raspberry_simple_gpio', raspberry_simple_gpio, true);
}