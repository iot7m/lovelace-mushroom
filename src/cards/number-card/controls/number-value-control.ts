import { HassEntity } from "home-assistant-js-websocket";
import { css, CSSResultGroup, html, LitElement, TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  getDefaultFormatOptions,
  getNumberFormatOptions,
  HomeAssistant,
  isActive,
  isAvailable,
} from "../../../ha";
import "../../../shared/slider";
import "../../../shared/input-number";

import { PropertyValues } from "lit";

@customElement("mushroom-number-value-control")
export class NumberValueControl extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property({ attribute: false }) public entity!: HassEntity;

  @property({ attribute: false }) public displayMode?: "slider" | "buttons";

  private _dbgLastLogTs = 0;
  private _dbgLastHassRef?: any;
  private _dbgLastEntityRef?: any;

  protected willUpdate(changedProps: PropertyValues): void {
    if (!changedProps.has("hass")) return;

    const now = performance.now();
    const prevHass = changedProps.get("hass") as any;
    const nextHass = this.hass as any;

    const eid = this.entity?.entity_id;

    // --- refs (super important) ---
    const hassRefChanged = prevHass !== nextHass;
    const statesRefChanged = prevHass?.states !== nextHass?.states;
    const entitiesRefChanged = prevHass?.entities !== nextHass?.entities;

    const prevStateObj = eid ? prevHass?.states?.[eid] : undefined;
    const nextStateObj = eid ? nextHass?.states?.[eid] : undefined;

    const thisEntityObjRefChanged = prevStateObj !== nextStateObj;

    // --- entity diffs (cheap) ---
    const stateChanged = prevStateObj?.state !== nextStateObj?.state;
    const lastChangedChanged = prevStateObj?.last_changed !== nextStateObj?.last_changed;
    const lastUpdatedChanged = prevStateObj?.last_updated !== nextStateObj?.last_updated;

    // Attributes: log only keys that changed (no stringify)
    const attrChangedKeys: string[] = [];
    const pAttr = prevStateObj?.attributes || {};
    const nAttr = nextStateObj?.attributes || {};

    // compare union of keys (bounded)
    const keys = new Set<string>([...Object.keys(pAttr), ...Object.keys(nAttr)]);
    for (const k of keys) {
      if (pAttr[k] !== nAttr[k]) attrChangedKeys.push(k);
    }

    // --- other "interesting" hass fields (rare but useful) ---
    const diff: Record<string, unknown> = {};
    if (prevHass?.connected !== nextHass?.connected) diff.connected = { prev: prevHass?.connected, next: nextHass?.connected };
    if (prevHass?.panelUrl !== nextHass?.panelUrl) diff.panelUrl = { prev: prevHass?.panelUrl, next: nextHass?.panelUrl };
    if (prevHass?.locale !== nextHass?.locale) diff.locale = { prev: prevHass?.locale, next: nextHass?.locale };
    if (prevHass?.language !== nextHass?.language) diff.language = { prev: prevHass?.language, next: nextHass?.language };
    if (prevHass?.config?.unit_system !== nextHass?.config?.unit_system) {
      diff.unit_system = { prev: prevHass?.config?.unit_system, next: nextHass?.config?.unit_system };
    }

    // Decide if we should log:
    // - always log when entity state/attrs changed
    // - otherwise log at most once per 1000ms (throttle), because hass may refresh constantly
    const interesting =
      stateChanged ||
      lastChangedChanged ||
      lastUpdatedChanged ||
      attrChangedKeys.length > 0 ||
      Object.keys(diff).length > 0;

    const throttleMs = 1000;
    const allowByThrottle = now - this._dbgLastLogTs > throttleMs;

    if (!interesting && !allowByThrottle) return;

    this._dbgLastLogTs = now;

    console.log("[NVC] hass update probe", {
      eid,
      // refs
      hassRefChanged,
      statesRefChanged,
      entitiesRefChanged,
      thisEntityObjRefChanged,

      // entity
      stateChanged,
      prevState: prevStateObj?.state,
      nextState: nextStateObj?.state,
      last_changed: lastChangedChanged ? { prev: prevStateObj?.last_changed, next: nextStateObj?.last_changed } : undefined,
      last_updated: lastUpdatedChanged ? { prev: prevStateObj?.last_updated, next: nextStateObj?.last_updated } : undefined,
      attrChangedKeys,

      // hass meta
      hassMetaDiffKeys: Object.keys(diff),
      hassMetaDiff: diff,

      t: now.toFixed(1),
    });
  }

  protected updated(changedProps: PropertyValues): void {
    const keys = Array.from(changedProps.keys());
    console.log("[NVC-arufanov] updated", {
      changedProps: keys,
      entityId: this.entity?.entity_id,
      entityState: this.entity?.state,
      t: performance.now().toFixed(1),
    });
  }

  onChange(e: CustomEvent<{ value: number }>): void {
    const value = e.detail.value;
    const domain = this.entity.entity_id.split(".")[0];
    this.hass.callService(domain, "set_value", {
      entity_id: this.entity.entity_id,
      value: value,
    });
  }

  onCurrentChange(e: CustomEvent<{ value?: number }>): void {
    console.log("[NVC-arufanov] current-change", {
      value: e.detail.value,
      entityState: this.entity?.state,
      t: performance.now().toFixed(1),
    });

    const value = e.detail.value;

    this.dispatchEvent(
      new CustomEvent("current-change", {
        detail: {
          value,
        },
      })
    );
  }

  protected render(): TemplateResult {
    console.log("[NVC-arufanov] render", {
      entityId: this.entity?.entity_id,
      entityState: this.entity?.state,
      displayMode: this.displayMode,
      t: performance.now().toFixed(1),
    });

    const value = Number(this.entity.state);

    const formatOptions =
      getNumberFormatOptions(
        this.entity,
        this.hass.entities[this.entity.entity_id]
      ) ?? getDefaultFormatOptions(this.entity.state);

    if (this.displayMode === "buttons") {
      return html`
        <mushroom-input-number
          .locale=${this.hass.locale}
          .value=${!isNaN(value) ? value : undefined}
          .min=${this.entity.attributes.min}
          .max=${this.entity.attributes.max}
          .step=${this.entity.attributes.step}
          .disabled=${!isAvailable(this.entity)}
          .formatOptions=${formatOptions}
          @change=${this.onChange}
        ></mushroom-input-number>
      `;
    }

    return html`
      <mushroom-slider
        .value=${!isNaN(value) ? value : undefined}
        .disabled=${!isAvailable(this.entity)}
        .inactive=${!isActive(this.entity)}
        .showActive=${true}
        .min=${this.entity.attributes.min}
        .max=${this.entity.attributes.max}
        .step=${this.entity.attributes.step}
        @change=${this.onChange}
        @current-change=${this.onCurrentChange}
      />
    `;
  }

  static get styles(): CSSResultGroup {
    return css`
      :host {
        --slider-color: rgb(var(--rgb-state-number));
        --slider-outline-color: transparent;
        --slider-bg-color: rgba(var(--rgb-state-number), 0.2);
      }
      mushroom-slider {
        --main-color: var(--slider-color);
        --bg-color: var(--slider-bg-color);
        --main-outline-color: var(--slider-outline-color);
      }
    `;
  }
}
