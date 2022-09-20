// Copyright (C) 2016 The Android Open Source Project
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

package com.google.gerrit.index.query;

import static com.google.common.base.Preconditions.checkArgument;

import com.google.common.collect.FluentIterable;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.Iterables;
import com.google.common.collect.Ordering;
import com.google.gerrit.exceptions.StorageException;
import com.google.gerrit.index.IndexConfig;
import com.google.gerrit.index.PaginationType;
import com.google.gerrit.index.QueryOptions;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

public class AndSource<T> extends AndPredicate<T> implements DataSource<T> {
  protected final DataSource<T> source;

  private final IsVisibleToPredicate<T> isVisibleToPredicate;
  private final int start;
  private final int cardinality;
  private final IndexConfig indexConfig;

  public AndSource(Collection<? extends Predicate<T>> that, IndexConfig indexConfig) {
    this(that, null, 0, indexConfig);
  }

  public AndSource(
      Predicate<T> that, IsVisibleToPredicate<T> isVisibleToPredicate, IndexConfig indexConfig) {
    this(that, isVisibleToPredicate, 0, indexConfig);
  }

  public AndSource(
      Predicate<T> that,
      IsVisibleToPredicate<T> isVisibleToPredicate,
      int start,
      IndexConfig indexConfig) {
    this(ImmutableList.of(that), isVisibleToPredicate, start, indexConfig);
  }

  public AndSource(
      Collection<? extends Predicate<T>> that,
      IsVisibleToPredicate<T> isVisibleToPredicate,
      int start,
      IndexConfig indexConfig) {
    super(that);
    checkArgument(start >= 0, "negative start: %s", start);
    this.isVisibleToPredicate = isVisibleToPredicate;
    this.start = start;

    int c = Integer.MAX_VALUE;
    DataSource<T> s = null;
    int minCost = Integer.MAX_VALUE;
    for (Predicate<T> p : getChildren()) {
      if (p instanceof DataSource) {
        c = Math.min(c, ((DataSource<?>) p).getCardinality());

        int cost = p.estimateCost();
        if (cost < minCost) {
          s = toDataSource(p);
          minCost = cost;
        }
      }
    }
    this.source = s;
    this.cardinality = c;
    this.indexConfig = indexConfig;
  }

  @Override
  public ResultSet<T> read() {
    if (source == null) {
      throw new StorageException("No DataSource: " + this);
    }

    // ResultSets are lazy. Calling #read here first and then dealing with ResultSets only when
    // requested allows the index to run asynchronous queries.
    ResultSet<T> resultSet = source.read();
    return new LazyResultSet<>(
        () -> {
          List<T> r = new ArrayList<>();
          T last = null;
          int pageResultSize = 0;
          for (T data : buffer(resultSet)) {
            if (!isMatchable() || match(data)) {
              r.add(data);
            }
            last = data;
            pageResultSize++;
          }

          if (last != null && source instanceof Paginated) {
            // Restart source and continue if we have not filled the
            // full limit the caller wants.
            //
            @SuppressWarnings("unchecked")
            Paginated<T> p = (Paginated<T>) source;
            QueryOptions opts = p.getOptions();
            final int limit = opts.limit();
            int pageSize = opts.pageSize();
            int pageSizeMultiplier = opts.pageSizeMultiplier();
            Object searchAfter = resultSet.searchAfter();
            int nextStart = pageResultSize;
            while (pageResultSize == pageSize && r.size() < limit) {
              pageSize = getNextPageSize(pageSize, pageSizeMultiplier);
              ResultSet<T> next =
                  indexConfig.paginationType().equals(PaginationType.SEARCH_AFTER)
                      ? p.restart(searchAfter, pageSize)
                      : p.restart(nextStart, pageSize);
              pageResultSize = 0;
              for (T data : buffer(next)) {
                if (match(data)) {
                  r.add(data);
                }
                pageResultSize++;
              }
              nextStart += pageResultSize;
              searchAfter = next.searchAfter();
            }
          }

          if (start >= r.size()) {
            return ImmutableList.of();
          } else if (start > 0) {
            return ImmutableList.copyOf(r.subList(start, r.size()));
          }
          return ImmutableList.copyOf(r);
        });
  }

  @Override
  public ResultSet<FieldBundle> readRaw() {
    // TOOD(hiesel): Implement
    throw new UnsupportedOperationException("not implemented");
  }

  @Override
  public boolean isMatchable() {
    return isVisibleToPredicate != null || super.isMatchable();
  }

  @Override
  public boolean match(T object) {
    if (isVisibleToPredicate != null && !isVisibleToPredicate.match(object)) {
      return false;
    }

    if (super.isMatchable() && !super.match(object)) {
      return false;
    }

    return true;
  }

  private Iterable<T> buffer(ResultSet<T> scanner) {
    return FluentIterable.from(Iterables.partition(scanner, 50))
        .transformAndConcat(this::transformBuffer);
  }

  protected List<T> transformBuffer(List<T> buffer) {
    return buffer;
  }

  @Override
  public int getCardinality() {
    return cardinality;
  }

  @SuppressWarnings("unchecked")
  private DataSource<T> toDataSource(Predicate<T> pred) {
    return (DataSource<T>) pred;
  }

  private int getNextPageSize(int pageSize, int pageSizeMultiplier) {
    List<Integer> possiblePageSizes = new ArrayList<>(3);
    try {
      possiblePageSizes.add(Math.multiplyExact(pageSize, pageSizeMultiplier));
    } catch (ArithmeticException e) {
      possiblePageSizes.add(Integer.MAX_VALUE);
    }
    if (indexConfig.maxPageSize() > 0) {
      possiblePageSizes.add(indexConfig.maxPageSize());
    }
    if (indexConfig.maxLimit() > 0) {
      possiblePageSizes.add(indexConfig.maxLimit());
    }
    return Ordering.natural().min(possiblePageSizes);
  }
}
