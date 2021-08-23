/**
 * A simple form to set actor movement speeds
 * @implements {DocumentSheet}
 */
export default class ActorMovementConfig extends DocumentSheet{

  /** @override */
	static get defaultOptions() {
	  return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["sns"],
      template: "systems/sns/templates/apps/movement-config.html",
      width: 300,
      height: "auto"
    });
  }

  /* -------------------------------------------- */

  /** @override */
  get title() {
    return `${game.i18n.localize("SNS.MovementConfig")}: ${this.entity.name}`;
  }

  /* -------------------------------------------- */

  /** @override */
  getData(options) {
    const sourceMovement = foundry.utils.getProperty(this.document.data._source, "data.attributes.movement") || {};
    const data = {
      movement: foundry.utils.deepClone(sourceMovement),
      units: CONFIG.SNS.movementUnits
    }
    for ( let [k, v] of Object.entries(data.movement) ) {
      if ( ["units", "hover"].includes(k) ) continue;
      data.movement[k] = Number.isNumeric(v) ? v.toNearest(0.1) : 0;
    }
    return data;
  }
}
