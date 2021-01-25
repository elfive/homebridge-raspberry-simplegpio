## homebridge-raspberry-simplegpio
<p align="center">
  <!-- <img src="https://raw.githubusercontent.com/elfive/homebridge-raspberry-simplegpio/master/images/petkit-feeder-mini.jpg">
  <br> -->
  <a href="https://www.npmjs.com/package/homebridge-raspberry-simplegpio">
    <img src="https://flat.badgen.net/npm/v/homebridge-raspberry-simplegpio" alt="NPM Version" />
  </a>
  <!-- <a href="https://www.npmjs.com/package/homebridge-raspberry-simplegpio">
    <img src="https://flat.badgen.net/npm/dt/homebridge-raspberry-simplegpio" alt="Total NPM Downloads" />
  </a> -->
  <!-- <a href="https://github.com/homebridge/homebridge/wiki/Verified-Plugins">
    <img src="https://flat.badgen.net/badge/homebridge/verified/purple" alt="Verified by Homebridge" />
  </a> -->
  <br>
  <strong><a href="#2-how-to-setup">Setup Guide</a> | <a href="#4-how-to-contribute">Contribute</a> </strong>
</p>

## 1) Description

control your raspberrry pi GPIO pins from homekit.

### features

- customize homekit accessory type
- no extra configure except homebridge config.json



### limitations

- from the plugin name, you may know that, this plugin only support those accesscories which can controled by a single pin.
  like switch, led, buzzer, relay...
- due to some restrictions initial pin status can only be high or low, ignore is not supported.



## 2) How to setup

1. wire your accessories, check wires are correctly connected to raspberry Pi before power it up.
2. edit config.json or just use the homebridge config UI panel to configure this plugin.


## 3) Configure

### config.json field

|  field   name  |  type  | required |         default         |       range       | description                                                  |
| :------------: | :----: | :------: | :---------------------: | :---------------: | ------------------------------------------------------------ |
|   accessory    | string |   yes    | 'raspberry_simple_gpio' |        ---        | homebridge required, must be 'raspberry_simple_gpio'         |
|      name      | string |   yes    |    'Raspberry-GPIO'     |        ---        | device name shows in HomeKit.                                |
| accessory_type | string |   yes    |        'switch'         | *see description* | one of these values:<br/>- fan<br/>- outlet<br/>- switch<br/>- contact_senser<br/>- leak_senser<br/>- motion_senser<br/>- occupancy_senser<br/>- smoke_senser |
|      pin       |  int   |   yes    |           ---           |       1-40        | raspberry GPIO pin number in **physical** mode, **NOT wPi or BCM mode** |
| reverse_status |  bool  |    no    |          false          |    true/false     | reverse pin status. If true then on for low, off for high; if false then on for high, off for low. |
|  init_status   | string |    no    |          'off'          |    'on'/'off'     | Init accessory status.                                       |
|   log_level    |  int   |    no    |            2            |     1,2,3,4,9     | one of these values:<br/>- 1: Debug<br/>- 2: Info<br/>- 3: Warn<br/>- 4: Error<br/>- 9: None |



### example of config.json file

```json
"accessories": [{
    "name": "CH1",
    "accessory_type": "switch",
    "pin": 40,
    "reverse_status": false,
    "init_status": "off",
    "log_level": 1,
    "accessory": "raspberry_simple_gpio"
}]
```



## 4) How to contribute

everyone is welcome to contribute to this plugin. PR/issue/debug all are welcome.

or you can send me an e-mail: elfive@elfive.cn

