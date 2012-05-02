// Copyright (C) 2011 The Android Open Source Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package com.google.gerrit.rules;

import static com.google.gerrit.rules.StoredValue.create;

import com.google.common.collect.Maps;
import com.google.gerrit.reviewdb.client.Account;
import com.google.gerrit.reviewdb.client.AccountDiffPreference.Whitespace;
import com.google.gerrit.reviewdb.client.Change;
import com.google.gerrit.reviewdb.client.PatchSet;
import com.google.gerrit.reviewdb.client.PatchSetInfo;
import com.google.gerrit.reviewdb.client.Project;
import com.google.gerrit.reviewdb.server.ReviewDb;
import com.google.gerrit.server.AnonymousUser;
import com.google.gerrit.server.IdentifiedUser;
import com.google.gerrit.server.git.GitRepositoryManager;
import com.google.gerrit.server.patch.PatchList;
import com.google.gerrit.server.patch.PatchListCache;
import com.google.gerrit.server.patch.PatchListKey;
import com.google.gerrit.server.patch.PatchSetInfoFactory;
import com.google.gerrit.server.patch.PatchSetInfoNotAvailableException;
import com.google.gerrit.server.project.ChangeControl;
import com.google.gerrit.server.query.change.ChangeData;

import com.googlecode.prolog_cafe.lang.Prolog;
import com.googlecode.prolog_cafe.lang.SystemException;

import org.eclipse.jgit.errors.RepositoryNotFoundException;
import org.eclipse.jgit.lib.ObjectId;
import org.eclipse.jgit.lib.Repository;

import java.util.Map;

public final class StoredValues {
  public static final StoredValue<ReviewDb> REVIEW_DB = create(ReviewDb.class);
  public static final StoredValue<Change> CHANGE = create(Change.class);
  public static final StoredValue<ChangeData> CHANGE_DATA = create(ChangeData.class);
  public static final StoredValue<PatchSet> PATCH_SET = create(PatchSet.class);
  public static final StoredValue<ChangeControl> CHANGE_CONTROL = create(ChangeControl.class);

  public static final StoredValue<PatchSetInfo> PATCH_SET_INFO = new StoredValue<PatchSetInfo>() {
    @Override
    public PatchSetInfo createValue(Prolog engine) {
      Change change = StoredValues.CHANGE.get(engine);
      PatchSet ps = StoredValues.PATCH_SET.get(engine);
      PrologEnvironment env = (PrologEnvironment) engine.control;
      PatchSetInfoFactory patchInfoFactory =
          env.getInjector().getInstance(PatchSetInfoFactory.class);
      try {
        return patchInfoFactory.get(change, ps);
      } catch (PatchSetInfoNotAvailableException e) {
        throw new SystemException(e.getMessage());
      }
    }
  };

  public static final StoredValue<PatchList> PATCH_LIST = new StoredValue<PatchList>() {
    @Override
    public PatchList createValue(Prolog engine) {
      PrologEnvironment env = (PrologEnvironment) engine.control;
      PatchSetInfo psInfo = StoredValues.PATCH_SET_INFO.get(engine);
      PatchListCache plCache = env.getInjector().getInstance(PatchListCache.class);
      Change change = StoredValues.CHANGE.get(engine);
      Project.NameKey projectKey = change.getProject();
      ObjectId a = null;
      ObjectId b = ObjectId.fromString(psInfo.getRevId());
      Whitespace ws = Whitespace.IGNORE_NONE;
      PatchListKey plKey = new PatchListKey(projectKey, a, b, ws);
      PatchList patchList = plCache.get(plKey);
      if (patchList == null) {
        throw new SystemException("Cannot create " + plKey);
      }
      return patchList;
    }
  };

  public static final StoredValue<Repository> REPOSITORY = new StoredValue<Repository>() {
    @Override
    public Repository createValue(Prolog engine) {
      PrologEnvironment env = (PrologEnvironment) engine.control;
      GitRepositoryManager gitMgr =
        env.getInjector().getInstance(GitRepositoryManager.class);
      Change change = StoredValues.CHANGE.get(engine);
      Project.NameKey projectKey = change.getProject();
      final Repository repo;
      try {
        repo = gitMgr.openRepository(projectKey);
      } catch (RepositoryNotFoundException e) {
        throw new SystemException(e.getMessage());
      }
      env.addToCleanup(new Runnable() {
        @Override
        public void run() {
          repo.close();
        }
      });
      return repo;
    }
  };

  public static final StoredValue<AnonymousUser> ANONYMOUS_USER =
      new StoredValue<AnonymousUser>() {
        @Override
        protected AnonymousUser createValue(Prolog engine) {
          PrologEnvironment env = (PrologEnvironment) engine.control;
          return env.getInjector().getInstance(AnonymousUser.class);
        }
      };

  public static final StoredValue<Map<Account.Id, IdentifiedUser>> USERS =
      new StoredValue<Map<Account.Id, IdentifiedUser>>() {
        @Override
        protected Map<Account.Id, IdentifiedUser> createValue(Prolog engine) {
          return Maps.newHashMap();
        }
      };

  private StoredValues() {
  }
}