import { SymbolView, type SFSymbol } from "@/lib/icon";
import { Feather } from "@/lib/icon";
import React, { type ComponentProps, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Radii, Spacing, useTheme, sem } from "@/theme";

interface GroupProps {
  header?: string;
  footer?: string;
  children: ReactNode;
  inset?: boolean;
}

export function ListGroup({ header, footer, children, inset = true }: GroupProps) {
  return (
    <View style={{ marginBottom: Spacing.xl }}>
      {header && (
        <Text
          style={[
            styles.header,
            { color: sem("labelSecondary"), paddingHorizontal: inset ? Spacing.lg : 0 },
          ]}
        >
          {header.toUpperCase()}
        </Text>
      )}
      <View
        style={[
          styles.group,
          {
            backgroundColor: sem("groupedSurface"),
            marginHorizontal: inset ? Spacing.lg : 0,
            borderRadius: Radii.lg,
          },
        ]}
      >
        {children}
      </View>
      {footer && (
        <Text
          style={[
            styles.footer,
            { color: sem("labelSecondary"), paddingHorizontal: inset ? Spacing.lg : 0 },
          ]}
        >
          {footer}
        </Text>
      )}
    </View>
  );
}

interface RowProps {
  title: string;
  subtitle?: string;
  value?: string;
  sfSymbol?: SFSymbol;
  featherIcon?: ComponentProps<typeof Feather>["name"];
  iconColor?: string;
  iconBg?: string;
  accessory?: "chevron" | "checkmark" | "none";
  destructive?: boolean;
  onPress?: () => void;
  right?: ReactNode;
  isFirst?: boolean;
  isLast?: boolean;
  testID?: string;
}

export function ListRow({
  title,
  subtitle,
  value,
  sfSymbol,
  featherIcon,
  iconColor,
  iconBg,
  accessory = "chevron",
  destructive,
  onPress,
  right,
  isFirst,
  isLast,
  testID,
}: RowProps) {
  const t = useTheme();
  const titleColor = destructive ? (sem("systemRed") as string) : (sem("label") as string);
  const radii = {
    borderTopLeftRadius: isFirst ? Radii.lg : 0,
    borderTopRightRadius: isFirst ? Radii.lg : 0,
    borderBottomLeftRadius: isLast ? Radii.lg : 0,
    borderBottomRightRadius: isLast ? Radii.lg : 0,
  };
  const content = (
    <>
      {(sfSymbol || featherIcon) && (
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: iconBg ?? "transparent" },
          ]}
        >
          {sfSymbol && t.isIOS ? (
            <SymbolView
              name={sfSymbol}
              tintColor={iconColor ?? (sem("label") as string)}
              size={iconBg ? 16 : 22}
            />
          ) : featherIcon ? (
            <Feather
              name={featherIcon}
              size={iconBg ? 16 : 20}
              color={iconColor ?? (sem("label") as string)}
            />
          ) : null}
        </View>
      )}
      <View style={styles.body}>
        <Text style={[styles.title, { color: titleColor }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.subtitle, { color: sem("labelSecondary") }]} numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>
      {right ??
        (value ? (
          <Text style={[styles.value, { color: sem("labelSecondary") }]} numberOfLines={1}>
            {value}
          </Text>
        ) : null)}
      {accessory === "chevron" && onPress && (
        t.isIOS ? (
          <SymbolView name="chevron.right" tintColor={sem("labelTertiary") as string} size={13} />
        ) : (
          <Feather name="chevron-right" size={14} color={sem("labelTertiary") as string} />
        )
      )}
      {accessory === "checkmark" && (
        t.isIOS ? (
          <SymbolView name="checkmark" tintColor={t.Brand.teal} size={16} />
        ) : (
          <Feather name="check" size={16} color={t.Brand.teal} />
        )
      )}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.row,
          radii,
          { backgroundColor: pressed ? (sem("fillTertiary") as string) : "transparent" },
        ]}
      >
        {content}
      </Pressable>
    );
  }
  return (
    <View testID={testID} style={[styles.row, radii]}>
      {content}
    </View>
  );
}

export function ListDivider({ inset = 52 }: { inset?: number }) {
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        marginLeft: inset,
        backgroundColor: sem("separator") as string,
      }}
    />
  );
}

const styles = StyleSheet.create({
  header: {
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: 0.2,
    marginBottom: 6,
    marginTop: 2,
  },
  footer: {
    fontSize: 12,
    marginTop: 8,
    lineHeight: 16,
  },
  group: { overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
    minHeight: 44,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 17, fontWeight: "400", letterSpacing: -0.41 },
  subtitle: { fontSize: 13, letterSpacing: -0.08 },
  value: { fontSize: 15 },
});
