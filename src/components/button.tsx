// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import {Platform} from 'react-native';
import {Button as ElButton, ButtonProps} from '@rneui/themed';
import {useTheme} from '../hooks';
import {palette} from '../theme/palette';

type Props = Omit<ButtonProps, 'children'> & {children?: React.ReactNode};

const Button = React.memo<Props>(
  ({
    containerStyle,
    buttonStyle,
    titleStyle,
    disabledStyle,
    disabledTitleStyle,
    type = Platform.OS === 'ios' ? 'clear' : 'solid',
    ...props
  }) => {
    const {dark} = useTheme();
    const colors = palette(dark);
    return (
      <ElButton
        type={type}
        containerStyle={[{width: '100%', borderRadius: 16}, containerStyle]}
        buttonStyle={[
          {minHeight: 48, borderRadius: 16, paddingHorizontal: 20},
          buttonStyle,
        ]}
        titleStyle={[
          {
            fontSize: 15,
            fontWeight: '600',
            color: type === 'solid' ? colors.onPrimary : colors.primary,
          },
          titleStyle,
        ]}
        disabledStyle={[{backgroundColor: colors.inset}, disabledStyle]}
        disabledTitleStyle={[{color: colors.muted}, disabledTitleStyle]}
        {...props}
      />
    );
  },
);

export default Button;
