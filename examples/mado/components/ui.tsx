// Mado's controls in Solid Glass's look: smoky panes with a hairline edge and
// a soft shadow, one clear-glass state for hovered, chosen and open, and the
// brand emerald for what the user acts on. The look is all classes over the
// theme's tokens (`theme.json`), so light and dark follow the appearance.
import { Text, View, token } from "nsh";
import { Input } from "nsh/base";
import { Button } from "nsh/base";
import { Icon, type IconName } from "./Icon";

/** The thickest pane: popovers, menus, the bubble menu. */
export const PANE = "rounded-2xl border border-border bg-popover shadow-xl backdrop-blur-xl";
/** A bar along an edge of the window: the toolbar, the status bar. */
export const BAR = "bg-card backdrop-blur-xl border-border";
/** The one state: hovered, chosen and held open. */
export const STATE = "bg-accent";

export function IconButton(props: {
  icon: IconName;
  label: string;
  /** The keystroke the tooltip shows (`⌘B`). */
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  testID?: string;
  size?: "small" | "regular";
  onPress: () => void;
}) {
  const box = () => (props.size === "small" ? "size-7 rounded-lg" : "size-8 rounded-(--radius-control)");
  return (
    <View tooltip={props.shortcut ? `${props.label}  ${props.shortcut}` : props.label}>
      <Button
        testID={props.testID}
        accessibilityLabel={props.label}
        selected={props.active}
        disabled={props.disabled}
        onPress={props.onPress}
        class={`${box()} items-center justify-center border ${
          props.active ? `${STATE} border-border` : "border-transparent"
        } hover:bg-accent active:bg-accent disabled:opacity-35`}
      >
        <Icon name={props.icon} size={16} tint={props.active ? token("brand") : token("foreground")} />
      </Button>
    </View>
  );
}

/** A button with a label: `primary` is the brand's solid pane, `ghost` a quiet one. */
export function TextButton(props: {
  label: string;
  icon?: IconName;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  testID?: string;
  onPress: () => void;
}) {
  const look = () =>
    props.variant === "primary"
      ? "bg-brand border-brand active:opacity-90"
      : props.variant === "danger"
        ? "bg-destructive border-destructive active:opacity-90"
        : "bg-transparent border-border hover:bg-accent active:bg-accent";
  const ink = () => (props.variant === "primary" ? "text-brand-foreground" : props.variant === "danger" ? "text-white" : "text-foreground");
  return (
    <Button
      testID={props.testID}
      accessibilityLabel={props.label}
      disabled={props.disabled}
      onPress={props.onPress}
      class={`h-8 flex-row items-center gap-1.5 rounded-(--radius-control) border px-3 disabled:opacity-40 ${look()}`}
    >
      <If when={props.icon}>
        <Icon
          name={props.icon as IconName}
          size={14}
          tint={props.variant === "primary" ? token("brand-foreground") : token("foreground")}
        />
      </If>
      <Text class={`text-sm font-medium ${ink()}`}>{props.label}</Text>
    </Button>
  );
}

/** A thin line between a toolbar's groups. */
export function Separator() {
  return <View class="mx-1 h-5 w-px bg-border" />;
}

/** A one-line field of clear glass. */
export function Field(props: {
  value: string;
  placeholder?: string;
  testID?: string;
  autoFocus?: boolean;
  onChange: (text: string) => void;
  onSubmit?: () => void;
}) {
  return (
    <Input
      testID={props.testID}
      value={props.value}
      placeholder={props.placeholder}
      autoFocus={props.autoFocus}
      autoCapitalize="none"
      autoCorrect={false}
      onChange={props.onChange}
      onSubmit={() => props.onSubmit?.()}
      class="h-8 rounded-(--radius-control) border border-input bg-field px-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring"
    />
  );
}

/** A small caption above a group of controls. */
export function Label(props: { children: string }) {
  return <Text class="text-xs font-medium uppercase tracking-wide text-muted-foreground">{props.children}</Text>;
}

/** An error, inline where it happened. */
export function ErrorNote(props: { message: string; onDismiss?: () => void }) {
  return (
    <View testID="error" class="flex-row items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2">
      <Text class="flex-1 text-sm text-destructive">{props.message}</Text>
      <If when={props.onDismiss}>
        <IconButton size="small" icon="x" label="Dismiss" onPress={() => props.onDismiss?.()} />
      </If>
    </View>
  );
}
