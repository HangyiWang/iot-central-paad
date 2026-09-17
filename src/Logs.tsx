// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, {useMemo, useRef, useState} from 'react';
import {FlatList, Platform, Pressable, StyleSheet, View} from 'react-native';
import {Icon} from '@rneui/themed';
import {useLogger, useTheme} from 'hooks';
import {Headline, Text} from './components/typography';
import Strings, {resolveString} from 'strings';
import {TimedLog} from './types';
import {palette} from './theme/palette';

export function logLevel(eventName: string): 'info' | 'warning' | 'error' {
  if (/\berror\b/i.test(eventName)) return 'error';
  if (/\bwarn(?:ing)?\b/i.test(eventName)) return 'warning';
  return 'info';
}

const Logs = React.memo(() => {
  const {dark} = useTheme();
  const appearance = palette(dark);
  const [logs] = useLogger();
  const [issuesOnly, setIssuesOnly] = useState(false);
  const list = useRef<FlatList<TimedLog[number]>>(null);
  const entries = useMemo(
    () =>
      issuesOnly
        ? logs.filter(entry => logLevel(entry.logItem.eventName) !== 'info')
        : logs,
    [issuesOnly, logs],
  );
  const text = Strings.LogScreen;
  return (
    <View style={[styles.container, {backgroundColor: appearance.background}]}>
      <View style={styles.heading}>
        <Headline>{text.Title}</Headline>
        <Text style={[styles.supporting, {color: appearance.muted}]}>
          {text.Header}
        </Text>
        <View style={styles.toolbar}>
          <Text style={[styles.supporting, {color: appearance.muted}]}>
            {resolveString(text.Count, String(entries.length))}
          </Text>
          <Pressable
            testID="logs-latest"
            accessibilityRole="button"
            accessibilityState={{disabled: !entries.length}}
            disabled={!entries.length}
            onPress={() => list.current?.scrollToEnd({animated: true})}
            style={styles.textAction}>
            <Text
              style={[
                styles.actionLabel,
                {color: entries.length ? appearance.primary : appearance.muted},
              ]}>
              {text.Latest}
            </Text>
          </Pressable>
        </View>
        <View style={styles.filters}>
          {[false, true].map(issues => (
            <Pressable
              key={String(issues)}
              testID={issues ? 'logs-filter-issues' : 'logs-filter-all'}
              accessibilityRole="button"
              accessibilityState={{selected: issuesOnly === issues}}
              onPress={() => setIssuesOnly(issues)}
              style={[
                styles.filter,
                {
                  backgroundColor:
                    issuesOnly === issues
                      ? appearance.primary
                      : appearance.surface,
                  borderColor:
                    issuesOnly === issues
                      ? appearance.primary
                      : appearance.controlBorder,
                },
              ]}>
              <Text
                style={[
                  styles.actionLabel,
                  {
                    color:
                      issuesOnly === issues
                        ? appearance.onPrimary
                        : appearance.text,
                  },
                ]}>
                {issues ? text.Issues : text.All}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <FlatList
        ref={list}
        testID="logs-list"
        data={entries}
        keyExtractor={entry => String(entry.id)}
        renderItem={({item}) => <LogEvent entry={item} />}
        contentContainerStyle={styles.feed}
        ListEmptyComponent={
          <View style={[styles.empty, {backgroundColor: appearance.surface}]}>
            <View
              accessible={false}
              style={[
                styles.emptyIcon,
                {backgroundColor: appearance.tints[1]},
              ]}>
              <Icon
                name="history"
                type="material-community"
                color={appearance.text}
                size={28}
              />
            </View>
            <Text style={styles.emptyTitle}>
              {issuesOnly ? text.NoIssues : text.Empty}
            </Text>
            <Text style={[styles.emptyDetail, {color: appearance.muted}]}>
              {issuesOnly ? text.NoIssuesDetail : text.EmptyDetail}
            </Text>
          </View>
        }
      />
    </View>
  );
});

export const LogEvent = React.memo(({entry}: {entry: TimedLog[number]}) => {
  const {dark} = useTheme();
  const appearance = palette(dark);
  const [expanded, setExpanded] = useState(false);
  const level = logLevel(entry.logItem.eventName);
  const foreground = level === 'error' ? appearance.danger : appearance.text;
  const background =
    level === 'error'
      ? appearance.dangerSurface
      : level === 'warning'
      ? appearance.tints[3]
      : appearance.tints[1];
  const text = Strings.LogScreen;
  return (
    <View testID={`log-event-${entry.id}`} style={styles.eventRow}>
      <View accessible={false} style={styles.timeline}>
        <View style={[styles.eventIcon, {backgroundColor: background}]}>
          <Icon
            name={
              level === 'error'
                ? 'alert-circle-outline'
                : level === 'warning'
                ? 'alert-outline'
                : 'information-outline'
            }
            type="material-community"
            size={18}
            color={foreground}
          />
        </View>
        <View
          style={[styles.timelineLine, {backgroundColor: appearance.border}]}
        />
      </View>
      <View style={[styles.eventCard, {backgroundColor: appearance.surface}]}>
        <View style={styles.eventMeta}>
          <Text
            style={[
              styles.level,
              {backgroundColor: background, color: foreground},
            ]}>
            {text.Levels[level]}
          </Text>
          <Text style={[styles.timestamp, {color: appearance.muted}]}>
            {typeof entry.timestamp === 'number'
              ? new Date(entry.timestamp).toLocaleString()
              : entry.timestamp}
          </Text>
        </View>
        <Text selectable style={styles.eventTitle}>
          {entry.logItem.eventName}
        </Text>
        {!expanded && (
          <Text numberOfLines={3} style={styles.preview}>
            {entry.logItem.eventData}
          </Text>
        )}
        <Pressable
          testID={`log-toggle-${entry.id}`}
          accessibilityRole="button"
          accessibilityLabel={`${expanded ? text.HideDetails : text.Details}: ${
            entry.logItem.eventName
          }`}
          accessibilityState={{expanded}}
          onPress={() => setExpanded(current => !current)}
          style={styles.textAction}>
          <Text style={[styles.actionLabel, {color: appearance.primary}]}>
            {expanded ? text.HideDetails : text.Details}
          </Text>
          <View accessible={false}>
            <Icon
              name={expanded ? 'chevron-up' : 'chevron-down'}
              type="material-community"
              size={18}
              color={appearance.primary}
            />
          </View>
        </Pressable>
        {expanded && (
          <View style={[styles.payload, {backgroundColor: appearance.inset}]}>
            <Text
              testID={`log-payload-${entry.id}`}
              selectable
              style={styles.payloadText}>
              {entry.logItem.eventData}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {flex: 1},
  heading: {paddingHorizontal: 20, paddingTop: 18, gap: 4},
  supporting: {fontSize: 13, lineHeight: 20},
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filters: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16},
  filter: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    borderWidth: 1,
  },
  actionLabel: {fontSize: 13, lineHeight: 19, fontWeight: '600'},
  textAction: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  feed: {paddingHorizontal: 20, paddingBottom: 24, flexGrow: 1},
  eventRow: {flexDirection: 'row', gap: 10},
  timeline: {width: 32, alignItems: 'center'},
  eventIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLine: {width: 1, flex: 1, marginVertical: 5},
  eventCard: {flex: 1, padding: 16, borderRadius: 20, marginBottom: 12, gap: 7},
  eventMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  level: {
    fontSize: 11,
    lineHeight: 17,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  timestamp: {fontSize: 11, lineHeight: 17, flexShrink: 1},
  eventTitle: {fontSize: 14, lineHeight: 21, fontWeight: '600'},
  preview: {fontSize: 14, lineHeight: 21},
  payload: {padding: 12, borderRadius: 12},
  payloadText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    lineHeight: 19,
  },
  empty: {padding: 28, borderRadius: 24, alignItems: 'center', gap: 12},
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyDetail: {fontSize: 14, lineHeight: 21, textAlign: 'center'},
});

export default Logs;
