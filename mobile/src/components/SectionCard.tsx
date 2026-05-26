import { PropsWithChildren } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../theme/tokens";

type Props = PropsWithChildren<{
  eyebrow: string;
  title: string;
}>;

export function SectionCard({ eyebrow, title, children }: Props) {
  return (
    <View style={styles.section}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
    paddingTop: spacing.sm
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.moss
  },
  title: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "800",
    color: colors.ink,
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      default: undefined
    })
  },
  body: {
    gap: spacing.sm,
    paddingTop: spacing.xs
  }
});
