'use strict';

const { LOGLV_INFO } = require("../log");

let PlatformAccessory, Accessory, Service, Characteristic, UUIDGen;

class baseAccessory {
    constructor(platform, homebridgeAccessory, config, categoryType) {
        PlatformAccessory = platform.api.platformAccessory;
        Accessory = platform.api.hap.Accessory;
        Service = platform.api.hap.Service;
        Characteristic = platform.api.hap.Characteristic;
        UUIDGen = platform.api.hap.uuid;

        this.platform = platform;
        this.log = platform.log;
        this.homebridgeAccessory = homebridgeAccessory;
        this.config = config;

        if (this.homebridgeAccessory) {
            if (!this.homebridgeAccessory.context.host) {
                this.homebridgeAccessory.context.host = this.config.host;
            }

            this.log(LOGLV_INFO,
                'Existing Accessory found [%s] [%s] [%s]',
                homebridgeAccessory.displayName,
                homebridgeAccessory.context.host,
                homebridgeAccessory.UUID
            );
            this.homebridgeAccessory.displayName = this.config.name;
        } else {
            this.log(LOGLV_INFO, 'Creating new Accessory %s', this.config.name);
            this.homebridgeAccessory = new PlatformAccessory(
                this.config.name,
                UUIDGen.generate(this.config.name),
                categoryType
            );
            this.homebridgeAccessory.context.host = this.deviceConfig.host;
            platform.registerPlatformAccessory(this.homebridgeAccessory);
        }

        let serviceType;
        switch (categoryType) {
            case Accessory.Categories.SWITCH:
                serviceType = Service.Switch;
                break;
            case Accessory.Categories.FAN:
                serviceType = Service.Fan;
                break;
            default:
                serviceType = Service.AccessoryInformation;
        }

        this.service = this.homebridgeAccessory.getService(serviceType);
        if (this.service) {
            this.service.setCharacteristic(Characteristic.Name, this.deviceConfig.name);
        } else {
            this.log(LOGLV_INFO, 'Creating new Service ' + this.deviceConfig.name);
            this.service = this.homebridgeAccessory.addService(serviceType, this.deviceConfig.name);
        }

        this.homebridgeAccessory.on('identify', (paired, callback) => {
            this.log(LOGLV_INFO, '[IDENTIFY][' + this.homebridgeAccessory.displayName + ']');
            callback();
        });
    }
}