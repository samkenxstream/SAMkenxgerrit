/**
 * @license
 * Copyright (C) 2016 The Android Open Source Project
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

import '../../../test/common-test-setup-karma.js';
import {getComputedStyleValue} from '../../../utils/dom-util.js';
import './gr-settings-view.js';
import {flush} from '@polymer/polymer/lib/legacy/polymer.dom.js';
import {GerritView} from '../../../services/router/router-model.js';
import {stubRestApi} from '../../../test/test-utils.js';

const basicFixture = fixtureFromElement('gr-settings-view');
const blankFixture = fixtureFromElement('div');

suite('gr-settings-view tests', () => {
  let element;
  let account;
  let preferences;
  let config;

  function valueOf(title, fieldsetid) {
    const sections = element.$[fieldsetid].querySelectorAll('section');
    let titleEl;
    for (let i = 0; i < sections.length; i++) {
      titleEl = sections[i].querySelector('.title');
      if (titleEl.textContent.trim() === title) {
        return sections[i].querySelector('.value');
      }
    }
  }

  // Because deepEqual isn't behaving in Safari.
  function assertMenusEqual(actual, expected) {
    assert.equal(actual.length, expected.length);
    for (let i = 0; i < actual.length; i++) {
      assert.equal(actual[i].name, expected[i].name);
      assert.equal(actual[i].url, expected[i].url);
    }
  }

  function stubAddAccountEmail(statusCode) {
    return stubRestApi('addAccountEmail').callsFake(
        () => Promise.resolve({status: statusCode}));
  }

  setup(done => {
    account = {
      _account_id: 123,
      name: 'user name',
      email: 'user@email',
      username: 'user username',
      registered: '2000-01-01 00:00:00.000000000',
    };
    preferences = {
      changes_per_page: 25,
      date_format: 'UK',
      time_format: 'HHMM_12',
      diff_view: 'UNIFIED_DIFF',
      email_strategy: 'ENABLED',
      email_format: 'HTML_PLAINTEXT',
      default_base_for_merges: 'FIRST_PARENT',
      relative_date_in_change_table: false,
      size_bar_in_change_table: true,

      my: [
        {url: '/first/url', name: 'first name', target: '_blank'},
        {url: '/second/url', name: 'second name', target: '_blank'},
      ],
      change_table: [],
    };
    config = {auth: {editable_account_fields: []}};

    stubRestApi('getAccount').returns(Promise.resolve(account));
    stubRestApi('getPreferences').returns(Promise.resolve(preferences));
    stubRestApi('getAccountEmails').returns(Promise.resolve());
    stubRestApi('getConfig').returns(Promise.resolve(config));
    element = basicFixture.instantiate();

    // Allow the element to render.
    element._testOnly_loadingPromise.then(done);
  });

  test('theme changing', () => {
    window.localStorage.removeItem('dark-theme');
    assert.isFalse(window.localStorage.getItem('dark-theme') === 'true');
    const themeToggle = element.shadowRoot
        .querySelector('.darkToggle paper-toggle-button');
    MockInteractions.tap(themeToggle);
    assert.isTrue(window.localStorage.getItem('dark-theme') === 'true');
    assert.equal(
        getComputedStyleValue('--primary-text-color', document.body), '#e8eaed'
    );
    MockInteractions.tap(themeToggle);
    assert.isFalse(window.localStorage.getItem('dark-theme') === 'true');
  });

  test('calls the title-change event', () => {
    const titleChangedStub = sinon.stub();

    // Create a new view.
    const newElement = document.createElement('gr-settings-view');
    newElement.addEventListener('title-change', titleChangedStub);

    const blank = blankFixture.instantiate();
    blank.appendChild(newElement);

    flush();

    assert.isTrue(titleChangedStub.called);
    assert.equal(titleChangedStub.getCall(0).args[0].detail.title,
        'Settings');
  });

  test('user preferences', done => {
    // Rendered with the expected preferences selected.
    assert.equal(valueOf('Changes per page', 'preferences')
        .firstElementChild.bindValue, preferences.changes_per_page);
    assert.equal(valueOf('Date/time format', 'preferences')
        .firstElementChild.bindValue, preferences.date_format);
    assert.equal(valueOf('Date/time format', 'preferences')
        .lastElementChild.bindValue, preferences.time_format);
    assert.equal(valueOf('Email notifications', 'preferences')
        .firstElementChild.bindValue, preferences.email_strategy);
    assert.equal(valueOf('Email format', 'preferences')
        .firstElementChild.bindValue, preferences.email_format);
    assert.equal(valueOf('Default Base For Merges', 'preferences')
        .firstElementChild.bindValue, preferences.default_base_for_merges);
    assert.equal(
        valueOf('Show Relative Dates In Changes Table', 'preferences')
            .firstElementChild.checked, false);
    assert.equal(valueOf('Diff view', 'preferences')
        .firstElementChild.bindValue, preferences.diff_view);
    assert.equal(valueOf('Show size bars in file list', 'preferences')
        .firstElementChild.checked, true);
    assert.equal(valueOf('Publish comments on push', 'preferences')
        .firstElementChild.checked, false);
    assert.equal(valueOf(
        'Set new changes to "work in progress" by default', 'preferences')
        .firstElementChild.checked, false);
    assert.equal(valueOf(
        'Insert Signed-off-by Footer For Inline Edit Changes', 'preferences')
        .firstElementChild.checked, false);

    assert.isFalse(element._prefsChanged);
    assert.isFalse(element._menuChanged);

    const publishOnPush =
        valueOf('Publish comments on push', 'preferences').firstElementChild;

    MockInteractions.tap(publishOnPush);

    assert.isTrue(element._prefsChanged);
    assert.isFalse(element._menuChanged);

    stubRestApi('savePreferences').callsFake(prefs => {
      assertMenusEqual(prefs.my, preferences.my);
      assert.equal(prefs.publish_comments_on_push, true);
      return Promise.resolve();
    });

    // Save the change.
    element._handleSavePreferences().then(() => {
      assert.isFalse(element._prefsChanged);
      assert.isFalse(element._menuChanged);
      done();
    });
  });

  test('publish comments on push', done => {
    const publishCommentsOnPush =
      valueOf('Publish comments on push', 'preferences').firstElementChild;
    MockInteractions.tap(publishCommentsOnPush);

    assert.isFalse(element._menuChanged);
    assert.isTrue(element._prefsChanged);

    stubRestApi('savePreferences').callsFake(prefs => {
      assert.equal(prefs.publish_comments_on_push, true);
      return Promise.resolve();
    });

    // Save the change.
    element._handleSavePreferences().then(() => {
      assert.isFalse(element._prefsChanged);
      assert.isFalse(element._menuChanged);
      done();
    });
  });

  test('set new changes work-in-progress', done => {
    const newChangesWorkInProgress =
      valueOf('Set new changes to "work in progress" by default',
          'preferences').firstElementChild;
    MockInteractions.tap(newChangesWorkInProgress);

    assert.isFalse(element._menuChanged);
    assert.isTrue(element._prefsChanged);

    stubRestApi('savePreferences').callsFake(prefs => {
      assert.equal(prefs.work_in_progress_by_default, true);
      return Promise.resolve();
    });

    // Save the change.
    element._handleSavePreferences().then(() => {
      assert.isFalse(element._prefsChanged);
      assert.isFalse(element._menuChanged);
      done();
    });
  });

  test('menu', done => {
    assert.isFalse(element._menuChanged);
    assert.isFalse(element._prefsChanged);

    assertMenusEqual(element._localMenu, preferences.my);

    const menu = element.$.menu.firstElementChild;
    let tableRows = menu.root.querySelectorAll('tbody tr');
    assert.equal(tableRows.length, preferences.my.length);

    // Add a menu item:
    element.splice('_localMenu', 1, 0, {name: 'foo', url: 'bar', target: ''});
    flush();

    tableRows = menu.root.querySelectorAll('tbody tr');
    assert.equal(tableRows.length, preferences.my.length + 1);

    assert.isTrue(element._menuChanged);
    assert.isFalse(element._prefsChanged);

    stubRestApi('savePreferences').callsFake(prefs => {
      assertMenusEqual(prefs.my, element._localMenu);
      return Promise.resolve();
    });

    element._handleSaveMenu().then(() => {
      assert.isFalse(element._menuChanged);
      assert.isFalse(element._prefsChanged);
      assertMenusEqual(element.prefs.my, element._localMenu);
      done();
    });
  });

  test('add email validation', () => {
    assert.isFalse(element._isNewEmailValid('invalid email'));
    assert.isTrue(element._isNewEmailValid('vaguely@valid.email'));

    assert.isFalse(
        element._computeAddEmailButtonEnabled('invalid email'), true);
    assert.isFalse(
        element._computeAddEmailButtonEnabled('vaguely@valid.email', true));
    assert.isTrue(
        element._computeAddEmailButtonEnabled('vaguely@valid.email', false));
  });

  test('add email does not save invalid', () => {
    const addEmailStub = stubAddAccountEmail(201);

    assert.isFalse(element._addingEmail);
    assert.isNotOk(element._lastSentVerificationEmail);
    element._newEmail = 'invalid email';

    element._handleAddEmailButton();

    assert.isFalse(element._addingEmail);
    assert.isFalse(addEmailStub.called);
    assert.isNotOk(element._lastSentVerificationEmail);

    assert.isFalse(addEmailStub.called);
  });

  test('add email does save valid', done => {
    const addEmailStub = stubAddAccountEmail(201);

    assert.isFalse(element._addingEmail);
    assert.isNotOk(element._lastSentVerificationEmail);
    element._newEmail = 'valid@email.com';

    element._handleAddEmailButton();

    assert.isTrue(element._addingEmail);
    assert.isTrue(addEmailStub.called);

    assert.isTrue(addEmailStub.called);
    addEmailStub.lastCall.returnValue.then(() => {
      assert.isOk(element._lastSentVerificationEmail);
      done();
    });
  });

  test('add email does not set last-email if error', done => {
    const addEmailStub = stubAddAccountEmail(500);

    assert.isNotOk(element._lastSentVerificationEmail);
    element._newEmail = 'valid@email.com';

    element._handleAddEmailButton();

    assert.isTrue(addEmailStub.called);
    addEmailStub.lastCall.returnValue.then(() => {
      assert.isNotOk(element._lastSentVerificationEmail);
      done();
    });
  });

  test('emails are loaded without emailToken', () => {
    sinon.stub(element.$.emailEditor, 'loadData');
    element.params = {};
    element.connectedCallback();
    assert.isTrue(element.$.emailEditor.loadData.calledOnce);
  });

  test('_handleSaveChangeTable', () => {
    let newColumns = ['Owner', 'Project', 'Branch'];
    element._localChangeTableColumns = newColumns.slice(0);
    element._showNumber = false;
    element._handleSaveChangeTable();
    assert.deepEqual(element.prefs.change_table, newColumns);
    assert.isNotOk(element.prefs.legacycid_in_change_table);

    newColumns = ['Size'];
    element._localChangeTableColumns = newColumns;
    element._showNumber = true;
    element._handleSaveChangeTable();
    assert.deepEqual(element.prefs.change_table, newColumns);
    assert.isTrue(element.prefs.legacycid_in_change_table);
  });

  test('reset menu item back to default', done => {
    const originalMenu = {
      my: [
        {url: '/first/url', name: 'first name', target: '_blank'},
        {url: '/second/url', name: 'second name', target: '_blank'},
        {url: '/third/url', name: 'third name', target: '_blank'},
      ],
    };

    stubRestApi('getDefaultPreferences').returns(Promise.resolve(originalMenu));

    const updatedMenu = [
      {url: '/first/url', name: 'first name', target: '_blank'},
      {url: '/second/url', name: 'second name', target: '_blank'},
      {url: '/third/url', name: 'third name', target: '_blank'},
      {url: '/fourth/url', name: 'fourth name', target: '_blank'},
    ];

    element.set('_localMenu', updatedMenu);

    element._handleResetMenuButton().then(() => {
      assertMenusEqual(element._localMenu, originalMenu.my);
      done();
    });
  });

  test('test that reset button is called', () => {
    const overlayOpen = sinon.stub(element, '_handleResetMenuButton');

    MockInteractions.tap(element.$.resetMenu);

    assert.isTrue(overlayOpen.called);
  });

  test('_showHttpAuth', () => {
    let serverConfig;

    serverConfig = {
      auth: {
        git_basic_auth_policy: 'HTTP',
      },
    };

    assert.isTrue(element._showHttpAuth(serverConfig));

    serverConfig = {
      auth: {
        git_basic_auth_policy: 'HTTP_LDAP',
      },
    };

    assert.isTrue(element._showHttpAuth(serverConfig));

    serverConfig = {
      auth: {
        git_basic_auth_policy: 'LDAP',
      },
    };

    assert.isFalse(element._showHttpAuth(serverConfig));

    serverConfig = {
      auth: {
        git_basic_auth_policy: 'OAUTH',
      },
    };

    assert.isFalse(element._showHttpAuth(serverConfig));

    serverConfig = {};

    assert.isFalse(element._showHttpAuth(serverConfig));
  });

  suite('_getFilterDocsLink', () => {
    test('with http: docs base URL', () => {
      const base = 'http://example.com/';
      const result = element._getFilterDocsLink(base);
      assert.equal(result, 'http://example.com/user-notify.html');
    });

    test('with http: docs base URL without slash', () => {
      const base = 'http://example.com';
      const result = element._getFilterDocsLink(base);
      assert.equal(result, 'http://example.com/user-notify.html');
    });

    test('with https: docs base URL', () => {
      const base = 'https://example.com/';
      const result = element._getFilterDocsLink(base);
      assert.equal(result, 'https://example.com/user-notify.html');
    });

    test('without docs base URL', () => {
      const result = element._getFilterDocsLink(null);
      assert.equal(result, 'https://gerrit-review.googlesource.com/' +
          'Documentation/user-notify.html');
    });

    test('ignores non HTTP links', () => {
      const base = 'javascript://alert("evil");';
      const result = element._getFilterDocsLink(base);
      assert.equal(result, 'https://gerrit-review.googlesource.com/' +
          'Documentation/user-notify.html');
    });
  });

  suite('when email verification token is provided', () => {
    let resolveConfirm;
    let confirmEmailStub;

    setup(() => {
      sinon.stub(element.$.emailEditor, 'loadData');
      confirmEmailStub = stubRestApi('confirmEmail').returns(
          new Promise(resolve => { resolveConfirm = resolve; }));
      element.params = {view: GerritView.SETTINGS, emailToken: 'foo'};
      element.connectedCallback();
    });

    test('it is used to confirm email via rest API', () => {
      assert.isTrue(confirmEmailStub.calledOnce);
      assert.isTrue(confirmEmailStub.calledWith('foo'));
    });

    test('emails are not loaded initially', () => {
      assert.isFalse(element.$.emailEditor.loadData.called);
    });

    test('user emails are loaded after email confirmed', done => {
      element._testOnly_loadingPromise.then(() => {
        assert.isTrue(element.$.emailEditor.loadData.calledOnce);
        done();
      });
      resolveConfirm();
    });

    test('show-alert is fired when email is confirmed', done => {
      sinon.spy(element, 'dispatchEvent');
      element._testOnly_loadingPromise.then(() => {
        assert.equal(
            element.dispatchEvent.lastCall.args[0].type, 'show-alert');
        assert.deepEqual(
            element.dispatchEvent.lastCall.args[0].detail, {message: 'bar'}
        );
        done();
      });
      resolveConfirm('bar');
    });
  });
});
