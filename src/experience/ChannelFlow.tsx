import React, {useId} from 'react';
import {Animated, StyleProp, StyleSheet, View, ViewStyle} from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import Svg, {Defs, LinearGradient, Path, Rect, Stop} from 'react-native-svg';

/**
 * The phone's connectors. Each one is a short, straight, round-jointed route
 * with a caret at both ends: the phone and the service talk to each other, so
 * neither end owns an arrow. The geometry is fixed. Nothing here reads, sends
 * or confirms anything; the optional light is a decorative connection-state
 * indicator, never packets, throughput or delivery.
 */
export const STRIP_HEIGHT = 34;
const TOP = 1;
const BOTTOM = STRIP_HEIGHT - 1;
const BEND_IN = 12;
const BEND_OUT = 22;
const CORNER = 6;
const CARET = 4;
const BAND = 64;

export type ChannelId = 'dps' | 'hub';
export type Channel = {id: ChannelId; from: number; to: number};

const round = (value: number) => Math.round(value * 100) / 100;

/** Vertical stub, rounded corner, short straight run, rounded corner, stub. */
export function channelPath(start: number, end: number): string {
  const from = round(start);
  const to = round(end);
  const length = Math.hypot(to - from, BEND_OUT - BEND_IN);
  const unitX = (to - from) / length;
  const unitY = (BEND_OUT - BEND_IN) / length;
  const enterX = round(from + unitX * CORNER);
  const enterY = round(BEND_IN + unitY * CORNER);
  const leaveX = round(to - unitX * CORNER);
  const leaveY = round(BEND_OUT - unitY * CORNER);
  return (
    `M${from} ${TOP} L${from} ${BEND_IN - CORNER} ` +
    `Q${from} ${BEND_IN} ${enterX} ${enterY} L${leaveX} ${leaveY} ` +
    `Q${to} ${BEND_OUT} ${to} ${BEND_OUT + CORNER} L${to} ${BOTTOM}`
  );
}

/** One caret at each end of the same route: a two-way connector, not a flow. */
export function caretPath(start: number, end: number): string {
  const from = round(start);
  const to = round(end);
  return (
    `M${from - CARET} ${TOP + CARET} L${from} ${TOP} L${from + CARET} ${
      TOP + CARET
    } ` +
    `M${to - CARET} ${BOTTOM - CARET} L${to} ${BOTTOM} L${to + CARET} ${
      BOTTOM - CARET
    }`
  );
}

function Sweep({
  channel,
  width,
  color,
  progress,
  gradientId,
}: {
  channel: Channel;
  width: number;
  color: string;
  progress: Animated.Value;
  gradientId: string;
}) {
  const direction = channel.from >= channel.to ? 1 : -1;
  // Start and finish with the band's faded edge on each end of its own route.
  const startX = channel.to - (direction * BAND) / 2;
  const endX = channel.from + (direction * BAND) / 2;
  return (
    <MaskedView
      testID={`home-map-flow-${channel.id}`}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
      maskElement={
        <Svg
          width="100%"
          height={STRIP_HEIGHT}
          viewBox={`0 0 ${width} ${STRIP_HEIGHT}`}
          preserveAspectRatio="none">
          <Path
            d={channelPath(channel.from, channel.to)}
            stroke="#ffffff"
            strokeOpacity={0.4}
            strokeWidth={9}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Path
            d={channelPath(channel.from, channel.to)}
            stroke="#ffffff"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      }>
      <Animated.View
        style={[
          styles.band,
          {
            opacity: progress.interpolate({
              inputRange: [0, 0.12, 0.88, 1],
              outputRange: [0, 1, 1, 0],
            }),
            transform: [
              {
                translateX: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [startX - BAND / 2, endX - BAND / 2],
                }),
              },
            ],
          },
        ]}>
        <Svg width={BAND} height={STRIP_HEIGHT}>
          <Defs>
            <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0" stopColor={color} stopOpacity={0} />
              <Stop offset="0.5" stopColor={color} stopOpacity={0.55} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect
            width={BAND}
            height={STRIP_HEIGHT}
            fill={`url(#${gradientId})`}
          />
        </Svg>
      </Animated.View>
    </MaskedView>
  );
}

export default function ChannelFlow({
  width,
  channels,
  color,
  glow,
  flowing,
  progress,
  style,
}: {
  width: number;
  channels: Channel[];
  color: string;
  glow: string;
  flowing: boolean;
  progress: Animated.Value;
  style?: Animated.WithAnimatedValue<StyleProp<ViewStyle>>;
}) {
  const prefix = `flow-${useId().replace(/\W/g, '')}`;
  return (
    <Animated.View pointerEvents="none" style={style}>
      <View style={styles.strip}>
        <Svg
          testID="home-map-phone-lines"
          height={STRIP_HEIGHT}
          width="100%"
          viewBox={`0 0 ${width} ${STRIP_HEIGHT}`}
          preserveAspectRatio="none"
          accessible={false}
          importantForAccessibility="no-hide-descendants">
          {channels.map(channel => (
            <Path
              key={`${channel.id}-route`}
              testID={`home-map-phone-${channel.id}-path`}
              d={channelPath(channel.from, channel.to)}
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
          {channels.map(channel => (
            <Path
              key={`${channel.id}-carets`}
              testID={`home-map-phone-${channel.id}-arrows`}
              d={caretPath(channel.from, channel.to)}
              stroke={color}
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
        </Svg>
        {flowing &&
          channels.map(channel => (
            <Sweep
              key={`${channel.id}-flow`}
              channel={channel}
              width={width}
              color={glow}
              progress={progress}
              gradientId={`${prefix}-${channel.id}`}
            />
          ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  strip: {height: STRIP_HEIGHT, overflow: 'hidden'},
  band: {position: 'absolute', left: 0, top: 0, width: BAND},
});
