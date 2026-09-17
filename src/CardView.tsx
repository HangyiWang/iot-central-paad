// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import {
  View,
  FlatList,
  ViewStyle,
  TextStyle,
  useWindowDimensions,
} from 'react-native';
import {ListItem} from '@rneui/themed';
import Strings from 'strings';
import {ItemProps, Literal} from 'types';
import {Card} from './components/card';
import {useTheme} from 'hooks';
import {normalize} from 'components/typography';
import BottomPopup from 'components/bottomPopup';

type CardPressCallback = (item: ItemProps) => void | Promise<void>;
type CardEditCallback = (item: ItemProps, value: any) => void | Promise<void>;

const CardView = React.memo<{
  items: ItemProps[];
  componentName?: string;
  onItemPress?: CardPressCallback;
  onItemLongPress?: CardPressCallback;
  onEdit?: CardEditCallback;
}>(({items, onItemPress, onItemLongPress, componentName, onEdit}) => {
  const [bottomItem, setBottomItem] = React.useState<ItemProps | undefined>(
    undefined,
  );
  const {colors} = useTheme();
  const {width, fontScale} = useWindowDimensions();
  const columns = width >= 700 && fontScale <= 1.3 ? 2 : 1;
  const styles = React.useMemo<Literal<ViewStyle | TextStyle>>(
    () => ({
      container: {flex: 1, backgroundColor: colors.background},
      list: {paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28},
      columns: {gap: 12},
      listItem: {
        backgroundColor: colors.card,
      },
      listItemText: {
        fontWeight: 'bold',
        fontSize: normalize(16),
        color: colors.text,
      },
      detailItemText: {
        fontSize: normalize(14),
        color: colors.text,
      },
    }),
    [colors],
  );

  const onCardLongPress = React.useCallback<CardPressCallback>(
    item => {
      setBottomItem(item);
    },
    [setBottomItem],
  );

  return (
    <View style={styles.container}>
      <FlatList
        key={`flatlist-${componentName}-${columns}`}
        numColumns={columns}
        contentContainerStyle={styles.list}
        columnWrapperStyle={columns === 2 ? styles.columns : undefined}
        showsVerticalScrollIndicator={false}
        data={items}
        keyExtractor={item => item.id}
        renderItem={getCard(
          columns,
          onItemPress,
          onItemLongPress ? onCardLongPress : undefined,
          onEdit,
        )}
      />
      <BottomPopup
        isVisible={bottomItem !== undefined}
        onDismiss={() => setBottomItem(undefined)}>
        <ListItem containerStyle={styles.listItem}>
          <ListItem.Content>
            <ListItem.Title style={styles.listItemText}>
              {bottomItem?.name}
            </ListItem.Title>
          </ListItem.Content>
        </ListItem>
        {bottomItem?.availability === 'unavailable' && bottomItem.enabled && (
          <ListItem
            onPress={() => {
              bottomItem.retry?.();
              setBottomItem(undefined);
            }}
            containerStyle={styles.listItem}>
            <ListItem.Content>
              <ListItem.Title style={styles.detailItemText}>
                {Strings.Sensors.Retry}
              </ListItem.Title>
            </ListItem.Content>
          </ListItem>
        )}
        <ListItem
          onPress={async () => {
            await onItemLongPress?.(bottomItem!);
            // close sheet
            setBottomItem(undefined);
          }}
          containerStyle={styles.listItem}>
          <ListItem.Content>
            <ListItem.Title style={styles.detailItemText}>
              {bottomItem?.enabled
                ? Strings.Core.DisableSensor
                : Strings.Core.EnableSensor}
            </ListItem.Title>
          </ListItem.Content>
        </ListItem>
      </BottomPopup>
    </View>
  );
});

const getCard =
  (
    columns: number,
    onItemPress?: CardPressCallback,
    onItemLongPress?: CardPressCallback,
    onEdit?: CardEditCallback,
  ) =>
  ({item}: {item: ItemProps}) =>
    (
      <Card
        containerStyle={columns === 2 ? {flexBasis: 0} : undefined}
        accentKey={item.id}
        title={item.name}
        value={item.value}
        unit={item.unit}
        dataType={item.dataType}
        enabled={item.enabled}
        availability={item.availability}
        simulated={item.simulated}
        editable={item.editable}
        presentation={item.presentation}
        icon={item.icon}
        // onToggle={() => item.enable(!item.enabled)}
        onLongPress={onItemLongPress && onItemLongPress.bind(null, item)} // edit card
        onEdit={onEdit?.bind(null, item)}
        onPress={
          item.enabled && onItemPress ? onItemPress.bind(null, item) : undefined
        }
      />
    );

export default CardView;
