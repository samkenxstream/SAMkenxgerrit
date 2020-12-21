/**
 * @license
 * Copyright (C) 2017 The Android Open Source Project
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
import {PolymerElement} from '@polymer/polymer/polymer-element';
import {getPluginLoader} from '../../shared/gr-js-api-interface/gr-plugin-loader';
import {customElement, property} from '@polymer/decorators';
import {ServerInfo} from '../../../types/common';

@customElement('gr-plugin-host')
export class GrPluginHost extends PolymerElement {
  @property({type: Object, observer: '_configChanged'})
  config?: ServerInfo;

  _configChanged(config: ServerInfo) {
    const plugins = config.plugin;
    const jsPlugins = (plugins && plugins.js_resource_paths) || [];
    const shouldLoadTheme = !!config.default_theme;
    // config.default_theme is defined when shouldLoadTheme is true
    const themeToLoad: string[] = shouldLoadTheme
      ? [config.default_theme!]
      : [];
    // Theme should be loaded first for better UX.
    const pluginsPending = themeToLoad.concat(jsPlugins);
    getPluginLoader().loadPlugins(pluginsPending);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gr-plugin-host': GrPluginHost;
  }
}
