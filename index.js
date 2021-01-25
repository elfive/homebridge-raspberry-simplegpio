'use strict';

let Service, Characteristic, api, storagePath;
let pin_duplicated = [];

const logUtil = require('./utils/log');
const configUtil = require('./utils/config');

const packageConfig = require('./package.json');
const fs = require('fs');
const Gpio = require('onoff').Gpio;


function PhysicToBCM(phy_pin) {
    const map = [
        null, null, 2, null, 3, null, 4, 14, null, 15,
        17, 18, 27, null, 22, 23, null, 24, 10, null,
        9, 25, 11, 8, null, 7, 0, 1, 5, null,
        6, 12, 13, null, 19, 16, 26, 20, null, 21];
    return map[phy_pin - 1];
}

function checkDuplicatePin() {
    let duplicatePins = [];
    try {
        let config = JSON.parse(fs.readFileSync(api.user.configPath()));
        let pins = config.accessories.filter((accessory) => {
            return (accessory.accessory === 'raspberry_simple_gpio' && accessory.pin !== undefined);
        }).map(accessory => accessory.pin);
        duplicatePins = [...new Set(pins.filter(pin => pins.indexOf(pin) !== pins.lastIndexOf(pin)))];
    } catch (error) {
        if (error) {
            console.log('could not find duplicate Pins in config.json: ' + error);
        }
    } finally {
        if (duplicatePins.count > 0) {
            console.log('find duplicate Pins in config.json: ' + JSON.stringify(duplicatePins));
        }
        return duplicatePins;
    }
}

class raspberry_simple_gpio_plugin {
    constructor(log, config) {
        this.config = new configUtil(config);
        this.log = new logUtil(log, this.config.fulfill('log_level', logUtil.LOGLV_INFO));
        this.services = [];

        // function
        this.accessory_update_status = (status) => this.log.warn('can not update senser status yet.');
    }

    getServices() {
        // check config usability
        this.log.debug('check config usability...');
        if (!this.configCheck()) {
            this.log.error('config usability check failed.');
            return this.services;
        }
        let pin = this.config.get('pin');
        if (pin_duplicated.indexOf(pin) > -1) {
            this.log.error('config.json contains duplicate pin: ' + pin);
            return this.services;
        }

        this.log.debug('config usability check passed.');

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
            .setCharacteristic(Characteristic.Name, this.config.get('name'))
            .setCharacteristic(Characteristic.FirmwareRevision, packageConfig.version);
        this.services.push(this.info_service);

        return this.services;
    }

    // config usability check
    // return valid config or null
    configCheck() {
        this.config.fulfill('name', 'Raspberry-GPIO');

        if (null === PhysicToBCM(this.config.get('pin'))) {
            this.log.error('pin ' + config.pin + ' is not controllable.');
            return false;
        }

        this.config.fulfill('reverse_status', false);

        if (undefined === this.config.get('init_status')) {
            this.config.set(init_status, 'off');
        } else if (!this.config.checkValueValid('init_status', ['on', 'off'])) {
            this.log.error('value of init_status can only be on or off.');
            return false;
        }
        
        return true;
    }
    
    getInitPinStatusFromConfigure() {
        return (this.config.get('init_status') === 'on' ? 1 : 0);
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
            activeLow : this.config.get('reverse_status')
        };

        const onGPIOValueChange = (device, service, characteristic) => {
            device.watch((err, value) => {
                if (err) {
                    this.log.error(err);
                } else {
                    const status = this.convertPinStatusToOnOff(value);
                    service.setCharacteristic(characteristic, status);
                }
            });
        };

        const setupGPIOOutService = (constructor, characteristic, name, accessory_type, gpio_options) => {
            this.log.debug('initializing accessory: ' + accessory_type);
        
            var service = null;
            const pin = this.config.get('pin');
            const initPinStatus = this.getInitPinStatusFromConfigure();
            const reverse_status = this.config.get('reverse_status');
            const initPinValue = initPinStatus === 1 ? (reverse_status ? 'low' : 'high') : (reverse_status ? 'high' : 'low');
            const gpio = new Gpio(PhysicToBCM(pin), initPinValue, gpio_options);
            if (gpio) {
                const status = this.convertPinStatusToOnOff(initPinStatus);
                
                service = new constructor(name);
                service.setCharacteristic(characteristic, status);
                service.getCharacteristic(characteristic)
                    .on('get', this.hb_get_status.bind(this, gpio))
                    .on('set', this.hb_set_status.bind(this, gpio));
                
                onGPIOValueChange(gpio, service, characteristic);

                process.on('SIGINT', _ => {
                    this.log.info('uninitializing accesssory.');
                    gpio.unexport();
                });

                this.log.info('successfully initizlized accessory.');
            } else {
                this.log.debug('unable to initialize accessory fan with gpio pin: ' + pin);
            }

            return service;
        };

        const setupGPIOInService = (constructor, characteristic, name, accessory_type, gpio_options) => {
            this.log.debug('initializing accessory: ' + accessory_type);
                
            var service = null;
            const pin = this.config.get('pin');
            const initPinStatus = this.getInitPinStatusFromConfigure();
            const gpio = new Gpio(PhysicToBCM(pin), 'in', 'both', gpio_options);
            if (gpio) {
                const status = this.convertPinStatusToOnOff(initPinStatus);
                
                service = new constructor(name);
                service.setCharacteristic(characteristic, status);
                service.getCharacteristic(characteristic)
                    .on('get', this.hb_get_status.bind(this, gpio));
                
                onGPIOValueChange(gpio, service, characteristic);
                this.log.info('successfully initizlized accessory.');
            } else {
                this.log.debug('unable to initialize accessory contact_sensor with gpio pin: ' + pin);
            }
            return service;
        };

        var service = null;
        if (Gpio.accessible) {
            const name = this.config.get('name');
            const accesssory_type = this.config.get('accessory_type');
            switch (accesssory_type) {
                case 'fan':
                    service = setupGPIOOutService(
                        Service.Fan, Characteristic.On,
                        name, accesssory_type, gpio_options);
                    break;
                case 'outlet':
                    service = setupGPIOOutService(
                        Service.Outlet, Characteristic.On,
                        name, accesssory_type, gpio_options);
                    break;
                case 'switch':
                    service = setupGPIOOutService(
                        Service.Switch, Characteristic.On,
                        name, accesssory_type, gpio_options);
                    break;
                case 'contact_sensor':
                    service = setupGPIOInService(
                        Service.ContactSensor, Characteristic.ContactSensorState,
                        name, accesssory_type, gpio_options);
                    break;
                case 'leak_sensor':
                    service = setupGPIOInService(
                        Service.LeakSensor, Characteristic.LeakDetected,
                        name, accesssory_type, gpio_options);
                    break;
                case 'motion_sensor':
                    service = setupGPIOInService(
                        Service.MotionSensor, Characteristic.MotionDetected,
                        name, accesssory_type, gpio_options);
                    break;
                case 'occupancy_sensor':
                    service = setupGPIOInService(
                        Service.OccupancySensor, Characteristic.OccupancyDetected,
                        name, accesssory_type, gpio_options);
                    break;
                case 'smoke_sensor':
                    service = setupGPIOInService(
                        Service.SmokeSensor, Characteristic.SmokeDetected,
                        name, accesssory_type, gpio_options);
                    break;
                default:
                    this.log.error('unsupported accessory: ' + accessory_type);
                    break;
            }
        } else {
            this.log.debug('current system not support gpio operations.');
        }

        return service;
    }

    hb_get_status(gpio, callback) {
        gpio.read((err, value) => {
            if (err) {
                this.log.error('get accessory status error: ' + err);
            } else {
                callback(null, value);
            }
        });
    }

    hb_set_status(gpio, value, callback) {
        gpio.write(value ? 1 : 0, (err) => {
            if (err) {
                this.log.error('set accessory status error: ' + err);
            }
            callback(null);
        });
    }
}

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    api = homebridge;
    storagePath = api.user.storagePath() + '/raspberry-simplegpio.json';
    pin_duplicated = checkDuplicatePin();
    homebridge.registerAccessory('homebridge-raspberry-simplegpio', 'raspberry_simple_gpio', raspberry_simple_gpio_plugin);
}