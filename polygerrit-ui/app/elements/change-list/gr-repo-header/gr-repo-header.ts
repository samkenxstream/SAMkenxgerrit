/**
 * @license
 * Copyright (C) 2018 The Android Open Source Project
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

import '../../../styles/dashboard-header-styles';
import '../../../styles/shared-styles';
import '../../shared/gr-date-formatter/gr-date-formatter';
import {PolymerElement} from '@polymer/polymer/polymer-element';
import {htmlTemplate} from './gr-repo-header_html';
import {GerritNav} from '../../core/gr-navigation/gr-navigation';
import {customElement, property} from '@polymer/decorators';
import {RepoName} from '../../../types/common';
import {WebLinkInfo} from '../../../types/diff';
import {appContext} from '../../../services/app-context';

@customElement('gr-repo-header')
export class GrRepoHeader extends PolymerElement {
  static get template() {
    return htmlTemplate;
  }

  @property({type: String, observer: '_repoChanged'})
  repo?: string;

  @property({type: String})
  _repoUrl: string | null = null;

  @property({type: Array})
  _webLinks: WebLinkInfo[] = [];

  private readonly restApiService = appContext.restApiService;

  _repoChanged(repoName: RepoName) {
    if (!repoName) {
      this._repoUrl = null;
      return;
    }

    this._repoUrl = GerritNav.getUrlForRepo(repoName);

    this.restApiService.getRepo(repoName).then(repo => {
      if (!repo?.web_links) return;
      this._webLinks = repo.web_links;
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gr-repo-header': GrRepoHeader;
  }
}
