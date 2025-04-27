'use strict';

const { debug, Cluster } = require('zigbee-clusters');
const TuyaSpecificCluster = require('../../lib/TuyaSpecificCluster');
const TuyaSpecificClusterDevice = require("../../lib/TuyaSpecificClusterDevice");
const { getDataValue } = require('../../lib/TuyaHelpers');
const { V1_FAN_SWITCH_DATA_POINTS } = require('../../lib/TuyaDataPoints');

const FanSpeed = Object.freeze({
  level_1:0,
  level_2:1,
  level_3:2,
  level_4:3,
  level_5:4});
Cluster.addCluster(TuyaSpecificCluster);

class fan_light_switch_tuya extends TuyaSpecificClusterDevice {

  async onNodeInit({ zclNode }) {
    this.printNode();
/*     debug(true);
    this.enableDebug(); */
// Initialize with default value    
    this.latestSpeedSetting = this.getSetting('latestSpeedSetting') || 0; 
  
    const { subDeviceId} = this.getData();
    this.log(`Initializing FanLightSwitchTuya - SubDevice: ${subDeviceId}, Device: ${this.getName()}`);
    const card = this.homey.flow.getActionCard('set_fan_speed');


    // Setup capability listeners and event handlers for each switch
    if (this.isSubDevice()) {
      // Handle each subdevice based on the subDeviceId
      switch (subDeviceId) {
        case 'secondSwitch':
          await this._setupGang(zclNode, 'LightSwitch', V1_FAN_SWITCH_DATA_POINTS.fanLightSwitch);
          break;
      }
    } else {
      // Main device for the fan
      await this._setupGang(zclNode, 'FanSwitch', V1_FAN_SWITCH_DATA_POINTS.fanSwitch);
// Register run listener for set_fan_speed action card
      card.registerRunListener(async (args, state) => {
        const value = args.fan_speed; // Extract the fan speed value
        this.log(`[${this.getName()}] Fan speed received from action card:`, value);
        // Convert percentage to fan speed enum
            let fanSpeedEnum;
            if (value <= 20) {
                fanSpeedEnum = FanSpeed.level_1;
            } else if (value <= 40) {
                fanSpeedEnum = FanSpeed.level_2;
            } else if (value <= 60) {
                fanSpeedEnum = FanSpeed.level_3;
            } else if (value <= 80) {
                fanSpeedEnum = FanSpeed.level_4;
            } else {
                fanSpeedEnum = FanSpeed.level_5;
            }
        try {
          await args.device.writeEnum(V1_FAN_SWITCH_DATA_POINTS.fanSpeed, fanSpeedEnum);
          this.log(`Action card: Fan speed set to:`, fanSpeedEnum);
        } catch (err) {
          this.error(`Error when writing fan speed:`, err);
          throw err;
        }
        });
  // Register capability listener for fan speed
  this.registerCapabilityListener('measure_fan_speed', async (value) => {
    this.log(`fan speed received:`, value);
        // Convert percentage to enum
        let fanSpeedEnum;
        if (value <= 20) {
            fanSpeedEnum = FanSpeed.level_1;
        } else if (value <= 40) {
            fanSpeedEnum = FanSpeed.level_2;
        } else if (value <= 60) {
            fanSpeedEnum = FanSpeed.level_3;
        } else if (value <= 80) {
            fanSpeedEnum = FanSpeed.level_4;
        } else {
            fanSpeedEnum = FanSpeed.level_5;
        }
    try {
      await this.writeEnum(V1_FAN_SWITCH_DATA_POINTS.fanSpeed, fanSpeedEnum);
      this.log(`Fan speed set to:`, fanSpeedEnum);
    } catch (err) {
      this.error(`Error when writing fan speed:`, err);
      throw err;
    }
  });
    }

      zclNode.endpoints[1].clusters.tuya.on("reporting", async (value) => {
        try {
          await this.processDatapoint(value);
        } catch (err) {
          this.error('Error processing datapoint:', err);
        }
      });

      zclNode.endpoints[1].clusters.tuya.on("response", async (value) => {
        try {
          await this.processDatapoint(value);
        } catch (err) {
          this.error('Error processing datapoint:', err);
        }
      });

  }

  async _setupGang(zclNode, gangName, dpOnOff) {
    // Register capability listener for on/off for each gang
    this.registerCapabilityListener('onoff', async (value) => {
      this.log(`${gangName} on/off:`, value);
      try {
        await this.writeBool(dpOnOff, value);
      } catch (err) {
        this.error(`Error when writing onOff for ${gangName}:`, err);
        throw err;
      }
    });
  }

  // Process DP reports and update Homey accordingly
  async processDatapoint(data) {
    const dp = data.dp;
    const parsedValue = getDataValue(data);
    const dataType = data.datatype;
    const { subDeviceId } = this.getData(); 
    this.log(`Processing DP ${dp}, Data Type: ${dataType}, Parsed Value:`, parsedValue);

    // Differentiate between Fan on/off, Fan Speed and Fan light by DP
    switch (dp) {
      case V1_FAN_SWITCH_DATA_POINTS.fanSwitch:
        this.log('Received on/off for  fanSwitch:', parsedValue);
        if (!this.isSubDevice()) {
   // Fix to handle that when powering on the fan sends it first the enum speed setting and then the display setting
   // i.e. enum 0 is shown as 1 on the display so after power on Homey always show one level to high, eg 20% when powering down becomes 40% aftar a powering up etc
          if (parsedValue === true){ 
            this.log('Latest speed setting for fan:', this.latestSpeedSetting);
            await this.setCapabilityValue('measure_fan_speed', (this.latestSpeedSetting)/5*100).catch(this.error);
          }
          await this.setCapabilityValue('onoff', parsedValue).catch(this.error);
          this.log('Received on/off for fan:', parsedValue);
        }
        break;

      case V1_FAN_SWITCH_DATA_POINTS.fanSpeed:
        this.log('Received speed setting for fan:', parsedValue);
        this.latestSpeedSetting = parsedValue;
        if (!this.isSubDevice()) {
          await this.setCapabilityValue('measure_fan_speed', (parsedValue+1)/5*100).catch(this.error);
        }
        break;

      case V1_FAN_SWITCH_DATA_POINTS.fanLightSwitch:
        this.log('Received on/off for fanlight:', parsedValue);
        if (subDeviceId === 'secondSwitch') {
          await this.setCapabilityValue('onoff', parsedValue).catch(this.error);
        }
        break;

        case V1_FAN_SWITCH_DATA_POINTS.powerOnStateSetting:
          this.log('Received  / Power on setting:', parsedValue);
          try {
          await this.setSettings({
            powerOnStateSetting : parsedValue.toString()
          });
        } catch (error) {
          this.log("This device does not support Relay Control", error);
        }
          break;
  
      default:
        this.log('Unhandled DP:', dp, 'with value:', parsedValue);
    }
  }

  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('Settings updated. Old:', oldSettings, 'New:', newSettings);
    if (changedKeys.includes('powerOnStateSetting')) {
    try {
      await this.writeEnum(V1_FAN_SWITCH_DATA_POINTS.powerOnStateSetting, newSettings.powerOnStateSetting);
      this.log(`Power On Setting ${newSettings.powerOnStateSetting}`);    } 
      catch (err) {
      this.error(`Error when changing powerOnStateSetting`, err);
      throw err;
    }
  }
}
  

  onDeleted() {
    this.log('Fan Light Switch Removed');
  }
}

module.exports = fan_light_switch_tuya;


/*
"ids": {

  "modelId": "TS0601",

  "manufacturerName": "_TZE204_lawxy9e2"

},

"endpoints": {

  "ieeeAddress": "a4:c1:38:a5:f1:c6:70:40",

  "networkAddress": 60324,

  "modelId": "TS0601",

  "manufacturerName": "_TZE204_lawxy9e2",

  "endpointDescriptors": [

    {

      "status": "SUCCESS",

      "nwkAddrOfInterest": 60324,

      "_reserved": 20,

      "endpointId": 1,

      "applicationProfileId": 260,

      "applicationDeviceId": 81,

      "applicationDeviceVersion": 0,

      "_reserved1": 1,

      "inputClusters": [

        4,

        5,

        61184,

        0

      ],

      "outputClusters": [

        25,

        10

      ]

    },

    {

      "status": "SUCCESS",

      "nwkAddrOfInterest": 60324,

      "_reserved": 10,

      "endpointId": 242,

      "applicationProfileId": 41440,

      "applicationDeviceId": 97,

      "applicationDeviceVersion": 0,

      "_reserved1": 0,

      "inputClusters": [],

      "outputClusters": [

        33

      ]

    }

  ],

  "deviceType": "router",

  "receiveWhenIdle": true,

  "capabilities": {

    "alternatePANCoordinator": false,

    "deviceType": true,

    "powerSourceMains": true,

    "receiveWhenIdle": true,

    "security": false,

    "allocateAddress": true

  },

  "extendedEndpointDescriptors": {

    "1": {

      "clusters": {

        "groups": {

          "attributes": [

            {

              "acl": [

                "readable",

                "reportable"

              ],

              "id": 0,

              "name": "nameSupport",

              "value": {

                "type": "Buffer",

                "data": [

                  0

                ]

              },

              "reportingConfiguration": {

                "status": "NOT_FOUND",

                "direction": "reported"

              }

            },

           {

              "acl": [

                "readable",

                "reportable"

              ],

              "id": 65533,

              "name": "clusterRevision",

              "value": 2,

              "reportingConfiguration": {

                "status": "NOT_FOUND",

                "direction": "reported"

              }

            }

          ]

        },

        "scenes": {

          "attributes": [

            {

              "acl": [

                "readable",

                "reportable"

              ],

              "id": 0,

              "reportingConfiguration": {

                "status": "NOT_FOUND",

                "direction": "reported"

              }

            },

           {

              "acl": [

                "readable",

                "reportable"

              ],

              "id": 1,

              "reportingConfiguration": {

                "status": "NOT_FOUND",

                "direction": "reported"

              }

            },

            {

              "acl": [

                "readable",

                "reportable"

              ],

              "id": 2,

              "reportingConfiguration": {

                "status": "NOT_FOUND",

                "direction": "reported"

              }

            },

            {

              "acl": [

                "readable",

                "reportable"

              ],

              "id": 3,

              "reportingConfiguration": {

                "status": "NOT_FOUND",

                "direction": "reported"

              }

            },

            {

              "acl": [

                "readable",

                "reportable"

              ],

              "id": 4,

              "reportingConfiguration": {

                "status": "NOT_FOUND",

                "direction": "reported"

              }

            },

            {

              "acl": [

                "readable",

                "reportable"

              ],

              "id": 65533,

              "name": "clusterRevision",

              "value": 2,

              "reportingConfiguration": {

                "status": "NOT_FOUND",

                "direction": "reported"

              }

            }

          ]

        },

        "basic": {

          "attributes": [

            {

              "acl": [

                "readable",

                "reportable"

              ],

              "id": 0,

              "name": "zclVersion",

              "value": 3

            },

            {

              "acl": [

                "readable",

                "reportable"

              ],

              "id": 1,

              "name": "appVersion",

              "value": 74

            },

            {

              "acl": [

                "readable",

                "reportable"

              ],

              "id": 2,

              "name": "stackVersion",

              "value": 0

            },

            {

              "acl": [

                "readable",

                "reportable"

              ],

              "id": 3,

              "name": "hwVersion",

              "value": 1

            },

            {

              "acl": [

                "readable",

                "reportable"

              ],

              "id": 4,

              "name": "manufacturerName",

              "value": "_TZE204_lawxy9e2"

            },

            {

              "acl": [

                "readable",

                "reportable"

              ],

              "id": 5,

              "name": "modelId",

              "value": "TS0601"

            },

            {

              "acl": [

                "readable",

                "reportable"

              ],

              "id": 6,

              "name": "dateCode",

              "value": ""

            },

            {

              "acl": [

                "readable",

                "reportable"

              ],

              "id": 7,

              "name": "powerSource",

              "value": "mains"

            },

            {

              "acl": [

                "readable",

                "writable",

                "reportable"

              ],

              "id": 65502

            },

            {

              "acl": [

                "readable",

                "reportable"

              ],

              "id": 65533,

              "name": "clusterRevision",

              "value": 2

            },

            {

              "acl": [

                "readable",

                "reportable"

              ],

              "id": 65534,

              "name": "attributeReportingStatus",

              "value": "PENDING"

            },

            {

              "acl": [

                "readable",

                "reportable"

              ],

              "id": 65506

            },

            {

              "acl": [

                "readable",

                "reportable"

              ],

              "id": 65507

            }

          ]

        }

      },

      "bindings": {

        "ota": {},

        "time": {

          "attributes": [

            {

              "acl": [

                "readable"

              ],

              "id": 65533,

              "name": "clusterRevision",

              "value": 1

            }

          ]

        }

      }

    },

    "242": {

      "clusters": {},

      "bindings": {}

    }

  }

}*/