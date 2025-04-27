'use strict';

const { ZigBeeDriver } = require('homey-zigbeedriver');

module.exports = class fan_light_switch_tuya extends ZigBeeDriver {

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('fan_light_switch Driver has been initialized');
  }
};
