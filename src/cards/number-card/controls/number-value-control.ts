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

  protected willUpdate(changedProps: PropertyValues): void {
    const changes = Array.from(changedProps.entries()).map(
      ([key, oldValue]) => ({
        prop: String(key),
        oldValue,
        newValue: (this as any)[key],
      })
    );

    // eslint-disable-next-line no-console
    console.log("[NVC-arufanov] willUpdate", {
      changes,
      entityId: this.entity?.entity_id,
      entityState: this.entity?.state,
      t: performance.now().toFixed(1),
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
