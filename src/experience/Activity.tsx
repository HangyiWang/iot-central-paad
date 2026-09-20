import React, {useContext, useMemo, useRef, useState} from 'react';
import {FlatList, Pressable, StyleSheet, View} from 'react-native';
import {Icon} from '@rneui/themed';
import {useIsFocused} from '@react-navigation/native';
import {Text} from '../components/typography';
import DetailsAction from '../components/detailsAction';
import SelectionControl from '../components/selectionControl';
import Logs from '../Logs';
import {useTheme} from '../hooks';
import {StorageContext} from '../contexts/storage';
import {useDeviceRuntime} from '../runtime/DeviceRuntime';
import {
  useObservationSnapshot,
  Observation,
  ObservationSnapshot,
} from '../observation';
import {palette} from '../theme/palette';
import {detailStyles} from '../theme/detailStyles';
import {ActivityStrings as text} from './activityStrings';

export function observationTitle(event: Observation): string {
  const action =
    event.kind === 'desired-property' && event.source === 'twin'
      ? text.TwinValue
      : event.kind === 'desired-property' && event.source === 'patch'
      ? text.DesiredUpdate
      : text.Channels[event.kind];
  return `${action} ${text.Outcomes[event.outcome]}`;
}

export function isObservationIssue(event: Observation): boolean {
  return (
    event.outcome === 'failed' ||
    event.outcome === 'rejected' ||
    (event.kind === 'command-reply' && event.response === 'error')
  );
}

function newest(events: (Observation | undefined)[]): Observation | undefined {
  return events.reduce<Observation | undefined>(
    (latest, event) =>
      event && (!latest || event.id > latest.id) ? event : latest,
    undefined,
  );
}

/** Deliberate interactions take precedence over periodic telemetry and twin reads. */
export function communicationObservations(snapshot: ObservationSnapshot) {
  if (!snapshot.active) return {outbound: undefined, inbound: undefined};
  const latest = snapshot.latest;
  return {
    outbound:
      newest([
        latest['reported-property'],
        latest['property-ack'],
        latest['command-reply'],
        latest.upload,
      ]) ?? newest([latest.telemetry, latest['twin-request']]),
    inbound: newest([latest.command, latest['desired-property']]),
  };
}

export function CommunicationSummary() {
  const {client} = useDeviceRuntime();
  const snapshot = useObservationSnapshot(client);
  const {simulated} = useContext(StorageContext);
  const {dark} = useTheme();
  const colors = palette(dark);
  const summary = communicationObservations(snapshot);
  return (
    <View style={styles.communication}>
      {simulated && (
        <Text style={[detailStyles.status, {color: colors.primary}]}>
          {text.Simulated}
        </Text>
      )}
      {(['outbound', 'inbound'] as const).map(direction => {
        const event = summary[direction];
        return (
          <View
            key={direction}
            testID={`communication-${direction}`}
            style={[styles.summary, {backgroundColor: colors.inset}]}>
            <View accessible={false}>
              <Icon
                name={direction === 'outbound' ? 'arrow-up' : 'arrow-down'}
                type="material-community"
                size={20}
                color={colors.primary}
              />
            </View>
            <View style={styles.body}>
              <Text style={[detailStyles.label, {color: colors.muted}]}>
                {direction === 'outbound' ? text.Outbound : text.Inbound}
              </Text>
              <Text style={detailStyles.value}>
                {event
                  ? observationTitle(event)
                  : direction === 'outbound'
                  ? text.NoOutbound
                  : text.NoInbound}
              </Text>
              {event && (
                <Text style={[detailStyles.supporting, {color: colors.muted}]}>
                  {text.Local}:{' '}
                  {new Date(event.observedAt).toLocaleTimeString()}
                </Text>
              )}
            </View>
          </View>
        );
      })}
      <Text style={[detailStyles.supporting, {color: colors.muted}]}>
        {text.NotReceipt}
      </Text>
    </View>
  );
}

export default function Activity() {
  const {client} = useDeviceRuntime();
  const snapshot = useObservationSnapshot(client);
  const {simulated} = useContext(StorageContext);
  const {dark} = useTheme();
  const colors = palette(dark);
  const [diagnostics, setDiagnostics] = useState(false);
  const focused = useIsFocused();
  const [diagnosticsVisited, visitDiagnostics] = useState(false);
  const [issuesOnly, setIssuesOnly] = useState(false);
  const list = useRef<FlatList<Observation>>(null);
  const entries = useMemo(
    () =>
      issuesOnly
        ? snapshot.history.filter(isObservationIssue)
        : snapshot.history,
    [issuesOnly, snapshot.history],
  );
  const telemetry = snapshot.latest.telemetry;
  const latestTelemetry =
    telemetry &&
    (!issuesOnly || isObservationIssue(telemetry)) &&
    !entries.some(event => event.id === telemetry.id)
      ? telemetry
      : undefined;
  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <View style={styles.heading}>
        <View style={styles.toolbar}>
          <Text
            accessibilityRole="header"
            style={[detailStyles.sheetTitle, styles.body]}>
            {text.Title}
          </Text>
          {!diagnostics && (
            <DetailsAction
              id="activity-latest"
              label={text.Latest}
              variant="quiet"
              icon="arrow-down"
              disabled={!entries.length && !latestTelemetry}
              onPress={() => list.current?.scrollToEnd({animated: false})}
            />
          )}
        </View>
        <Text style={[detailStyles.supporting, {color: colors.muted}]}>
          {text.Description}
        </Text>
        {simulated && (
          <Text style={[detailStyles.status, {color: colors.primary}]}>
            {text.Simulated}
          </Text>
        )}
        <SelectionControl
          label={text.Title}
          focused={focused}
          options={[
            {id: 'activity-observations', label: text.Observations},
            {id: 'activity-diagnostics', label: text.Diagnostics},
          ]}
          selected={diagnostics ? 1 : 0}
          onSelect={index => {
            if (index === 1) visitDiagnostics(true);
            setDiagnostics(index === 1);
          }}
        />
      </View>
      <View
        style={[styles.container, diagnostics && styles.hidden]}
        accessibilityElementsHidden={diagnostics}
        importantForAccessibility={
          diagnostics ? 'no-hide-descendants' : 'auto'
        }>
        <View style={styles.filters}>
          <Text style={[detailStyles.supporting, {color: colors.muted}]}>
            {text.Filter}
          </Text>
          <SelectionControl
            variant="filter"
            label={text.Filter}
            focused={focused && !diagnostics}
            options={[
              {id: 'activity-filter-all', label: text.All},
              {id: 'activity-filter-issues', label: text.Issues},
            ]}
            selected={issuesOnly ? 1 : 0}
            onSelect={index => setIssuesOnly(index === 1)}
          />
        </View>
        <FlatList
          ref={list}
          testID="activity-list"
          data={entries}
          keyExtractor={event => `${event.generation}-${event.id}`}
          renderItem={({item}) => <ObservationRow event={item} />}
          contentContainerStyle={styles.feed}
          ListHeaderComponent={
            <>
              {!snapshot.active && snapshot.generation > 0 && (
                <Text
                  style={[
                    styles.sessionNotice,
                    detailStyles.supporting,
                    {color: colors.muted},
                  ]}>
                  {text.Interrupted}
                </Text>
              )}
              {latestTelemetry && (
                <View>
                  <Text style={detailStyles.sectionTitle}>
                    {text.LatestTelemetry}
                  </Text>
                  <Text
                    style={[
                      detailStyles.supporting,
                      styles.sessionNotice,
                      {color: colors.muted},
                    ]}>
                    {text.TelemetryHistory}
                  </Text>
                  <ObservationRow event={latestTelemetry} />
                </View>
              )}
            </>
          }
          ListEmptyComponent={
            latestTelemetry ? null : (
              <View
                style={[detailStyles.card, {backgroundColor: colors.surface}]}>
                <Text style={detailStyles.sectionTitle}>
                  {issuesOnly ? text.NoIssues : text.Empty}
                </Text>
                <Text style={[detailStyles.value, {color: colors.muted}]}>
                  {issuesOnly ? text.NoIssuesDetail : text.EmptyDetail}
                </Text>
              </View>
            )
          }
        />
      </View>
      {diagnosticsVisited && (
        <View
          style={[styles.container, !diagnostics && styles.hidden]}
          accessibilityElementsHidden={!diagnostics}
          importantForAccessibility={
            !diagnostics ? 'no-hide-descendants' : 'auto'
          }>
          <Logs />
        </View>
      )}
    </View>
  );
}

export function ObservationRow({event}: {event: Observation}) {
  const {dark} = useTheme();
  const colors = palette(dark);
  const [expanded, setExpanded] = useState(false);
  const issue = isObservationIssue(event);
  const names =
    'names' in event
      ? event.names.join(', ')
      : 'name' in event
      ? event.name
      : null;
  return (
    <View
      testID={`activity-event-${event.id}`}
      style={[
        detailStyles.card,
        styles.event,
        {backgroundColor: colors.surface},
      ]}>
      <View style={styles.eventHeader}>
        <View style={[styles.body, styles.eventCopy]}>
          <Text
            style={[
              detailStyles.sectionTitle,
              {color: issue ? colors.danger : colors.text},
            ]}>
            {observationTitle(event)}
          </Text>
          <Text style={[detailStyles.supporting, {color: colors.muted}]}>
            {text.Local}: {new Date(event.observedAt).toLocaleString()}
          </Text>
        </View>
        <Pressable
          testID={`activity-toggle-${event.id}`}
          accessibilityRole="button"
          accessibilityState={{expanded}}
          accessibilityLabel={`${
            expanded ? text.HideDetails : text.Details
          }: ${observationTitle(event)}`}
          onPress={() => setExpanded(value => !value)}
          style={({pressed}) => [styles.disclosure, pressed && styles.pressed]}>
          <View
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants">
            <Icon
              name={expanded ? 'chevron-up' : 'chevron-down'}
              type="material-community"
              size={16}
              color={colors.muted}
            />
          </View>
        </Pressable>
      </View>
      {event.simulated && (
        <Text style={[detailStyles.status, {color: colors.primary}]}>
          {text.Simulated}
        </Text>
      )}
      {expanded && (
        <View testID={`activity-details-${event.id}`}>
          <Fact label={text.Channel} value={event.kind} />
          <Fact label={text.Session} value={String(event.generation)} />
          {names && <Fact label={text.Capability} value={names} />}
          {'correlation' in event && event.correlation && (
            <Fact label={text.Request} value={event.correlation.value} />
          )}
          {'version' in event && event.version !== null && (
            <Fact label={text.Version} value={String(event.version)} />
          )}
          {'source' in event && (
            <Fact label={text.Source} value={event.source} />
          )}
          {event.kind === 'command-reply' && (
            <Fact label={text.Reply} value={event.response} />
          )}
          {event.outcome === 'failed' && (
            <Fact label={text.Error} value={event.errorCode} />
          )}
          {event.kind === 'upload' &&
            event.outcome === 'acknowledged' &&
            event.status !== null && (
              <Fact label={text.Http} value={String(event.status)} />
            )}
          {event.identity?.deviceId && (
            <Fact label={text.Device} value={event.identity.deviceId} />
          )}
          {event.identity?.assignedHub && (
            <Fact label={text.Hub} value={event.identity.assignedHub} />
          )}
          {event.identity?.modelId && (
            <Fact label={text.Model} value={event.identity.modelId} />
          )}
          <Text style={[detailStyles.supporting, {color: colors.muted}]}>
            {event.kind === 'command-execution'
              ? text.PhysicalLimit
              : event.kind === 'upload'
              ? text.UploadChannel
              : text.NotReceipt}
          </Text>
        </View>
      )}
    </View>
  );
}

function Fact({label, value}: {label: string; value: string}) {
  const {dark} = useTheme();
  const colors = palette(dark);
  return (
    <View style={detailStyles.row}>
      <Text style={[detailStyles.label, {color: colors.muted}]}>{label}</Text>
      <Text selectable style={detailStyles.value}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  hidden: {display: 'none'},
  body: {flex: 1, minWidth: 0},
  heading: {paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, gap: 10},
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  filters: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  feed: {paddingHorizontal: 20, paddingBottom: 24},
  event: {marginBottom: 12},
  eventHeader: {flexDirection: 'row', alignItems: 'flex-start', gap: 8},
  eventCopy: {gap: 4},
  disclosure: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -8,
    marginEnd: -8,
  },
  pressed: {opacity: 0.6},
  sessionNotice: {marginBottom: 12},
  communication: {gap: 8},
  summary: {
    padding: 12,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
});
