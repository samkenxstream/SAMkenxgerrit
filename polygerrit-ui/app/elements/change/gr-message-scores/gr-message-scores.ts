/**
 * @license
 * Copyright (C) 2021 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {LitElement, css, html} from 'lit';
import {customElement, property} from 'lit/decorators';
import {
  ChangeMessage,
  LabelExtreme,
  PATCH_SET_PREFIX_PATTERN,
} from '../../../utils/comment-util';
import {hasOwnProperty} from '../../../utils/common-util';

const VOTE_RESET_TEXT = '0 (vote reset)';

interface Score {
  label?: string;
  value?: string;
}

export const LABEL_TITLE_SCORE_PATTERN =
  /^(-?)([A-Za-z0-9-]+?)([+-]\d+)?[.:]?$/;

@customElement('gr-message-scores')
export class GrMessageScores extends LitElement {
  @property()
  labelExtremes?: LabelExtreme;

  @property({type: Object})
  message?: ChangeMessage;

  static override get styles() {
    return css`
      .score {
        box-sizing: border-box;
        border-radius: var(--border-radius);
        color: var(--vote-text-color);
        display: inline-block;
        padding: 0 var(--spacing-s);
        text-align: center;
        margin-right: var(--spacing-s);
        min-width: 115px;
      }
      .score.removed {
        background-color: var(--vote-color-neutral);
      }
      .score.negative {
        background-color: var(--vote-color-disliked);
        border: 1px solid var(--vote-outline-disliked);
        line-height: calc(var(--line-height-normal) - 2px);
        color: var(--chip-color);
      }
      .score.negative.min {
        background-color: var(--vote-color-rejected);
        border: none;
        padding-top: 1px;
        padding-bottom: 1px;
        color: var(--vote-text-color);
      }
      .score.positive {
        background-color: var(--vote-color-recommended);
        border: 1px solid var(--vote-outline-recommended);
        line-height: calc(var(--line-height-normal) - 2px);
        color: var(--chip-color);
      }
      .score.positive.max {
        background-color: var(--vote-color-approved);
        border: none;
        padding-top: 1px;
        padding-bottom: 1px;
        color: var(--vote-text-color);
      }

      @media screen and (max-width: 50em) {
        .score {
          min-width: 0px;
        }
      }
    `;
  }

  override render() {
    const scores = this._getScores(this.message, this.labelExtremes);
    return scores.map(score => this.renderScore(score));
  }

  private renderScore(score: Score) {
    return html`<span
      class="score ${this._computeScoreClass(score, this.labelExtremes)}"
    >
      ${score.label} ${score.value}
    </span>`;
  }

  _computeScoreClass(score?: Score, labelExtremes?: LabelExtreme) {
    // Polymer 2: check for undefined
    if (score === undefined || labelExtremes === undefined) {
      return '';
    }
    if (!score.value) {
      return '';
    }
    if (score.value.includes(VOTE_RESET_TEXT)) {
      return 'removed';
    }
    const classes = [];
    if (Number(score.value) > 0) {
      classes.push('positive');
    } else if (Number(score.value) < 0) {
      classes.push('negative');
    }
    if (score.label) {
      const extremes = labelExtremes[score.label];
      if (extremes) {
        const intScore = Number(score.value);
        if (intScore === extremes.max) {
          classes.push('max');
        } else if (intScore === extremes.min) {
          classes.push('min');
        }
      }
    }
    return classes.join(' ');
  }

  _getScores(message?: ChangeMessage, labelExtremes?: LabelExtreme): Score[] {
    if (!message || !message.message || !labelExtremes) {
      return [];
    }
    const line = message.message.split('\n', 1)[0];
    const patchSetPrefix = PATCH_SET_PREFIX_PATTERN;
    if (!line.match(patchSetPrefix)) {
      return [];
    }
    const scoresRaw = line.split(patchSetPrefix)[1];
    if (!scoresRaw) {
      return [];
    }
    return scoresRaw
      .split(' ')
      .map(s => s.match(LABEL_TITLE_SCORE_PATTERN))
      .filter(
        ms => ms && ms.length === 4 && hasOwnProperty(labelExtremes, ms[2])
      )
      .map(ms => {
        const label = ms?.[2];
        const value = ms?.[1] === '-' ? VOTE_RESET_TEXT : ms?.[3];
        return {label, value};
      });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gr-message-scores': GrMessageScores;
  }
}