// Copyright (C) 2012 The Android Open Source Project
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

package com.google.gerrit.server.project;

import com.google.common.collect.ImmutableList;
import com.google.gerrit.common.data.SubmitRecord;
import com.google.gerrit.common.data.SubmitTypeRecord;
import com.google.gerrit.reviewdb.client.Change;
import com.google.gerrit.server.query.change.ChangeData;
import com.google.gerrit.server.rules.PrologRule;
import com.google.gwtorm.server.OrmException;
import com.google.inject.Inject;
import com.google.inject.assistedinject.Assisted;
import java.util.Collections;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Evaluates a submit-like Prolog rule found in the rules.pl file of the current project and filters
 * the results through rules found in the parent projects, all the way up to All-Projects.
 */
public class SubmitRuleEvaluator {
  private static final Logger log = LoggerFactory.getLogger(SubmitRuleEvaluator.class);
  private static final String DEFAULT_MSG = "Error evaluating project rules, check server log";

  private final ProjectCache projectCache;
  private final PrologRule prologRule;
  private final SubmitRuleOptions opts;

  public interface Factory {
    /** Returns a new {@link SubmitRuleEvaluator} with the specified options */
    SubmitRuleEvaluator create(SubmitRuleOptions options);
  }

  @Inject
  private SubmitRuleEvaluator(
      ProjectCache projectCache, PrologRule prologRule, @Assisted SubmitRuleOptions options) {
    this.projectCache = projectCache;
    this.prologRule = prologRule;

    this.opts = options;
  }

  public static List<SubmitRecord> defaultRuleError() {
    return createRuleError(DEFAULT_MSG);
  }

  public static List<SubmitRecord> createRuleError(String err) {
    SubmitRecord rec = new SubmitRecord();
    rec.status = SubmitRecord.Status.RULE_ERROR;
    rec.errorMessage = err;
    return Collections.singletonList(rec);
  }

  public static SubmitTypeRecord defaultTypeError() {
    return SubmitTypeRecord.error(DEFAULT_MSG);
  }

  /**
   * Evaluate the submit rules.
   *
   * @return List of {@link SubmitRecord} objects returned from the evaluated rules, including any
   *     errors.
   * @param cd ChangeData to evaluate
   */
  public List<SubmitRecord> evaluate(ChangeData cd) {
    Change change;
    ProjectState projectState;
    try {
      change = cd.change();
      if (change == null) {
        throw new OrmException("Change not found");
      }

      projectState = projectCache.get(cd.project());
      if (projectState == null) {
        throw new NoSuchProjectException(cd.project());
      }
    } catch (OrmException | NoSuchProjectException e) {
      return ruleError("Error looking up change " + cd.getId(), e);
    }

    if (!opts.allowClosed() && change.getStatus().isClosed()) {
      SubmitRecord rec = new SubmitRecord();
      rec.status = SubmitRecord.Status.CLOSED;
      return Collections.singletonList(rec);
    }

    return ImmutableList.copyOf(prologRule.evaluate(cd, opts));
  }

  private List<SubmitRecord> ruleError(String err, Exception e) {
    if (opts.logErrors()) {
      if (e == null) {
        log.error(err);
      } else {
        log.error(err, e);
      }
      return defaultRuleError();
    }
    return createRuleError(err);
  }

  /**
   * Evaluate the submit type rules to get the submit type.
   *
   * @return record from the evaluated rules.
   * @param cd
   */
  public SubmitTypeRecord getSubmitType(ChangeData cd) {
    ProjectState projectState;
    try {
      projectState = projectCache.get(cd.project());
      if (projectState == null) {
        throw new NoSuchProjectException(cd.project());
      }
    } catch (NoSuchProjectException e) {
      return typeError("Error looking up change " + cd.getId(), e);
    }

    return prologRule.getSubmitType(cd, opts);
  }

  private SubmitTypeRecord typeError(String err, Exception e) {
    if (opts.logErrors()) {
      if (e == null) {
        log.error(err);
      } else {
        log.error(err, e);
      }
      return defaultTypeError();
    }
    return SubmitTypeRecord.error(err);
  }
}
