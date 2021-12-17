/**
 * A specialized Dialog subclass for ability usage
 * @type {Dialog}
 */
export default class AbilityUseDialog extends Dialog {
  constructor(item, dialogData={}, options={}) {
    super(dialogData, options);
    this.options.classes = ["sns", "dialog"];

    /**
     * Store a reference to the Item entity being used
     * @type {Item5e}
     */
    this.item = item;
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /**
   * A constructor function which displays the Spell Cast Dialog app for a given Actor and Item.
   * Returns a Promise which resolves to the dialog FormData once the workflow has been completed.
   * @param {Item5e} item
   * @return {Promise}
   */
  static async create(item) {
    if ( !item.isOwned ) throw new Error("You cannot display an ability usage dialog for an unowned item");

    // Prepare data
    const actorData = item.actor.data.data;
    const itemData = item.data.data;
    const uses = itemData.uses || {};
    const quantity = itemData.quantity || 0;
    const recharge = itemData.recharge || {};
    const recharges = !!recharge.value;
    const sufficientUses = (quantity > 0 && !uses.value) || uses.value > 0; 

    // Prepare dialog form data
    const data = {
      item: item.data,
      title: game.i18n.format("SNS.AbilityUseHint", {type: game.i18n.localize(`SNS.ItemType${item.type.capitalize()}`), name: item.name}),
      note: this._getAbilityUseNote(item.data, uses, recharge),
      consumeSpellSlot: false,
      consumeRecharge: recharges,
      consumeResource: !!itemData.consume.target,
      consumeUses: uses.max,
      canUse: recharges ? recharge.charged : sufficientUses,
      createTemplate: game.user.can("TEMPLATE_CREATE") && item.hasAreaTarget,
      errors: []
    };
    if ( item.data.type === "spell" ) this._getSpellData(actorData, itemData, data);

    // Render the ability usage template
    const html = await renderTemplate("systems/sns/templates/apps/ability-use.html", data);

    // Create the Dialog and return data as a Promise
    const icon = data.isSpell ? "fa-magic" : "fa-fist-raised";
    const label = game.i18n.localize("SNS.AbilityUse" + (data.isSpell ? "Cast" : "Use"));
    return new Promise((resolve) => {
      const dlg = new this(item, {
        title: `${item.name}: ${game.i18n.localize("SNS.AbilityUseConfig")}`,
        content: html,
        buttons: {
          use: {
            icon: `<i class="fas ${icon}"></i>`,
            label: label,
            callback: html => {
              const fd = new FormDataExtended(html[0].querySelector("form"));
              resolve(fd.toObject());
            }
          }
        },
        default: "use",
        close: () => resolve(null)
      });
      dlg.render(true);
    });
  }

  /* -------------------------------------------- */
  /*  Helpers                                     */
  /* -------------------------------------------- */

  /**
   * Get dialog data related to limited spell slots
   * @private
   */
  static _getSpellData(actorData, itemData, data) {

    // Determine whether the spell may be up-cast
    const lvl = itemData.level;
    const consumeSpellSlot = (lvl > 0) && CONFIG.SNS.spellUpcastModes.includes(itemData.preparation.mode);

    // If can't upcast, return early and don't bother calculating available spell slots
    if (!consumeSpellSlot) {
      mergeObject(data, { isSpell: true, consumeSpellSlot });
      return;
    }

    // Determine the levels which are feasible
    let lmax = 0;
    const spellLevels = Array.fromRange(10).reduce((arr, i) => {
      if ( i < lvl ) return arr;
      const label = CONFIG.SNS.spellLevels[i];
      const l = actorData.spells["spell"+i] || {max: 0, override: null};
      let max = parseInt(l.override || l.max || 0);
      let slots = Math.clamped(parseInt(l.value || 0), 0, max);
      if ( max > 0 ) lmax = i;
      arr.push({
        level: i,
        label: i > 0 ? game.i18n.format('SNS.SpellLevelSlot', {level: label, n: slots}) : label,
        canCast: max > 0,
        hasSlots: slots > 0
      });
      return arr;
    }, []).filter(sl => sl.level <= lmax);

    // If this character has pact slots, present them as an option for casting the spell.
    const pact = actorData.spells.pact;
    if (pact.level >= lvl) {
      spellLevels.push({
        level: 'pact',
        label: `${game.i18n.format('SNS.SpellLevelPact', {level: pact.level, n: pact.value})}`,
        canCast: true,
        hasSlots: pact.value > 0
      });
    }
    // If this character has battery charges, present them as an option for casting the spell.
    const battery = actorData.spells.battery;
    if (battery.level >= lvl) {
      spellLevels.push({
        level: 'battery',
        label: `${game.i18n.format('SNS.SpellLevelBattery', {level: battery.level, n: battery.value})}`,
        canCast: true,
        hasSlots: battery.value > 0
      });
    }
    const canCast = spellLevels.some(l => l.hasSlots);
    if ( !canCast ) data.errors.push(game.i18n.format("SNS.SpellCastNoSlots", {
      level: CONFIG.SNS.spellLevels[lvl],
      name: data.item.name
    }));

    // Merge spell casting data
    return foundry.utils.mergeObject(data, { isSpell: true, consumeSpellSlot, spellLevels });
  }

  /* -------------------------------------------- */

  /**
   * Get the ability usage note that is displayed
   * @private
   */
  static _getAbilityUseNote(item, uses, recharge) {

    // Zero quantity
    const quantity = item.data.quantity;
    if ( quantity <= 0 ) return game.i18n.localize("SNS.AbilityUseUnavailableHint");

    // Abilities which use Recharge
    if ( !!recharge.value ) {
      return game.i18n.format(recharge.charged ? "SNS.AbilityUseChargedHint" : "SNS.AbilityUseRechargeHint", {
        type: game.i18n.localize(`SNS.ItemType${item.type.capitalize()}`),
      })
    }

    // Does not use any resource
    if ( !uses.per || !uses.max ) return "";

    // Consumables
    if ( item.type === "consumable" ) {
      let str = "SNS.AbilityUseNormalHint";
      if ( uses.value > 1 ) str = "SNS.AbilityUseConsumableChargeHint";
      else if ( item.data.quantity === 1 && uses.autoDestroy ) str = "SNS.AbilityUseConsumableDestroyHint";
      else if ( item.data.quantity > 1 ) str = "SNS.AbilityUseConsumableQuantityHint";
      return game.i18n.format(str, {
        type: game.i18n.localize(`SNS.Consumable${item.data.consumableType.capitalize()}`),
        value: uses.value,
        quantity: item.data.quantity,
        max: uses.max,
        per: CONFIG.SNS.limitedUsePeriods[uses.per]
      });
    }

    // Other Items
    else {
      return game.i18n.format("SNS.AbilityUseNormalHint", {
        type: game.i18n.localize(`DND5E.ItemType${item.type.capitalize()}`),
        value: uses.value,
        max: uses.max,
        per: CONFIG.SNS.limitedUsePeriods[uses.per]
      });
    }
  }
}