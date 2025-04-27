'use strict';

const { ZigBeeDriver } = require('homey-zigbeedriver');

module.exports = class garage_door_controller_tuya extends ZigBeeDriver {

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('garage_door_controller Driver has been initialized');
  }
};
