'use strict';

const { debug, Cluster } = require('zigbee-clusters');
const TuyaSpecificCluster = require('../../lib/TuyaSpecificCluster');
const TuyaSpecificClusterDevice = require("../../lib/TuyaSpecificClusterDevice");
const { getDataValue } = require('../../lib/TuyaHelpers');
 const {V1_GARAGE_DOOR_CONTROLLER_DATA_POINTS} = require('../../lib/TuyaDataPoints');
Cluster.addCluster(TuyaSpecificCluster);

class garage_door_controller_tuya extends TuyaSpecificClusterDevice {
  constructor(...args) {
    super(...args);
    this.doorMoving = false; // Declare at class level
  }

  async onNodeInit({ zclNode }) {
    await super.onNodeInit({ zclNode });

    this.printNode();
/*     debug(true);
    this.enableDebug(); */

    await zclNode.endpoints[1].clusters.basic.readAttributes(['manufacturerName', 'zclVersion', 'appVersion', 'modelId', 'powerSource', 'attributeReportingStatus'])
    .catch(err => {
      this.error('Error when reading device attributes ', err);
    });

    this.registerCapabilityListener('locked', async (open) =>{
      try{
      await this.writeBool(V1_GARAGE_DOOR_CONTROLLER_DATA_POINTS.door_opening, !open)
      this.log('Garage Door ordered not Locked = Open', !open)
    } catch (e) {
      this.log("Failed to set locked", e);
    } 
    });
 

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

    this.log("🚀 Garage Door Controller started!")

  }

  // Process DP reports and update Homey accordingly
async processDatapoint(data) {
  const dp = data.dp;
  const parsedValue = getDataValue(data);
  const dataType = data.datatype;

  this.log(`Processing DP ${dp}, Data Type: ${dataType}, Parsed Value:`, parsedValue);

  switch (dp) {
    case V1_GARAGE_DOOR_CONTROLLER_DATA_POINTS.door_opening: //DP=1
          this.log('Garage Door Opening', parsedValue);
          this.door_moving = true;
          break;

    case V1_GARAGE_DOOR_CONTROLLER_DATA_POINTS.powerOnStateSetting: //DP=2
          this.log('powerOnStateSetting, value:', parsedValue);
          break;

    case V1_GARAGE_DOOR_CONTROLLER_DATA_POINTS.doorSensorOpen: //DP=3
          this.log('Garage Door Closed', !parsedValue);
 // Prevent toggling of the capbiltiy while moving, i.e. when closing as DP3 is sent every 30s it may toggle otherwise
          if (!this.door_moving) {
          try {
            await this.setCapabilityValue('locked', !parsedValue);
          } catch (e) {
            this.log("Failed to set locked", e);
          }
        }
          break;

    case V1_GARAGE_DOOR_CONTROLLER_DATA_POINTS.operTimer: //DP=4
          this.log('operTimer (s), value:', parsedValue);
          break;

    case V1_GARAGE_DOOR_CONTROLLER_DATA_POINTS.autoCloseTimer: //DP=5
          this.log('autoCloseTimer value:', parsedValue);
          break;

    case V1_GARAGE_DOOR_CONTROLLER_DATA_POINTS.openingTimesupervision: //DP=11
          this.log('openingTimesupervision value:', parsedValue);
          break;

    case V1_GARAGE_DOOR_CONTROLLER_DATA_POINTS.operationResult: //DP=12
 //         this.log('operationResult value:', parsedValue);
        switch(parsedValue){
          case 0:
              this.log('DP12 Auto Close timeout:', parsedValue);
              this.door_moving = false;
           break;

          case 1:
              this.log('DP12 Door operation timeout:', parsedValue);
              this.door_moving = false;
           break;

          case 2:
              this.log('DP12 Operation success', parsedValue);
              this.door_moving = false;
           break;

        default:
              this.log('DP12 Unknown result :', parsedValue);  
        }
          break;

  default:
    this.log(`Unhandled DP: ${dp}, Data Type: ${dataType}, Value:`, parsedValue);
  }  
}


async onSettings({ oldSettings, newSettings, changedKeys }) {
  this.log('Settings updated. Old:', oldSettings, 'New:', newSettings);
  if (changedKeys.includes('powerOnStateSetting')) {
  try {
    await this.writeEnum(V1_GARAGE_DOOR_CONTROLLER_DATA_POINTS.powerOnStateSetting, newSettings.powerOnStateSetting);
    this.log(`Power On Setting ${newSettings.powerOnStateSetting}`);    } 
    catch (err) {
    this.error(`Error when changing powerOnStateSetting`, err);
    throw err;
  }
 }
if (changedKeys.includes('operTimer')) {
    try {
      await this.writeData32(V1_GARAGE_DOOR_CONTROLLER_DATA_POINTS.operTimer, newSettings.operTimer);
      this.log(`operTimer Setting ${newSettings.operTimer}`);    } 
      catch (err) {
      this.error(`Error when changing operTimer`, err);
      throw err;
    }
  }
  if (changedKeys.includes('autoCloseTimer')) {
    try {
      await this.writeData32(V1_GARAGE_DOOR_CONTROLLER_DATA_POINTS.autoCloseTimer, newSettings.autoCloseTimer);
      this.log(`autoCloseTimer Setting ${newSettings.autoCloseTimer}`);    } 
      catch (err) {
      this.error(`Error when changing autoCloseTimer`, err);
      throw err;
    }
  }

  if (changedKeys.includes('openingTimesupervision')) {
    try {
      await this.writeBool(V1_GARAGE_DOOR_CONTROLLER_DATA_POINTS.openingTimesupervision, newSettings.openingTimesupervision);
      this.log(`openingTimesupervision Setting ${newSettings.openingTimesupervision}`);    } 
      catch (err) {
      this.error(`Error when changing openingTimesupervision`, err);
      throw err;
    }
  }
}


  onDeleted() {
    this.log('Garage Door Controller removed');
  }

}

module.exports = garage_door_controller_tuya;

/*
  "ids": {
    "modelId": "TS0601",
    "manufacturerName": "_TZE204_nklqjk62"
  },
  "endpoints": {
    "ieeeAddress": "a4:c1:38:7a:06:84:5e:7a",
    "networkAddress": 8554,
    "modelId": "TS0601",
    "manufacturerName": "_TZE204_nklqjk62",
    "endpointDescriptors": [
      {
        "status": "SUCCESS",
        "nwkAddrOfInterest": 8554,
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
        "nwkAddrOfInterest": 8554,
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
                "value": "_TZE204_nklqjk62"
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
  }
*/
