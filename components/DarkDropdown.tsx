import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useState } from "react";
import {
    Dimensions,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
} from "react-native";

const COLORS = {
  background: "rgba(255, 255, 255, 0.75)", // Semi-transparent to let BlurView show through
  text: "#111827",
  selected: "rgba(0, 0, 0, 0.08)", // Transparent dark for selected item
  border: "rgba(209, 213, 219, 0.5)", // Semi-transparent border
  placeholder: "#6B7280",
};

type DropdownOption = {
  label: string;
  value: string | null;
};

type DarkDropdownProps = {
  value: string | null | undefined;
  options: DropdownOption[];
  placeholder: string;
  onChange: (value: string | null) => void;
  disabled?: boolean;
};

export default function DarkDropdown({
  value,
  options,
  placeholder,
  onChange,
  disabled = false,
}: DarkDropdownProps) {
  const [visible, setVisible] = useState(false);
  const [fieldWidth, setFieldWidth] = useState(0);
  const selectedOption = options.find((option) => option.value === value);
  const popupWidth = Math.min(
    Math.max(fieldWidth, 220),
    Dimensions.get("window").width - 32,
  );

  const choose = (nextValue: string | null) => {
    onChange(nextValue);
    setVisible(false);
  };

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.8}
        disabled={disabled}
        onLayout={(event) => setFieldWidth(event.nativeEvent.layout.width)}
        onPress={() => setVisible(true)}
        style={[styles.field, disabled && styles.disabled]}
      >
        <Text
          numberOfLines={2}
          style={[styles.fieldText, !selectedOption && styles.placeholder]}
        >
          {selectedOption?.label ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color={COLORS.text} />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          <BlurView
            intensity={75}
            tint="light"
            style={[styles.popup, { width: popupWidth }]}
          >
            <Pressable onPress={(event) => event.stopPropagation()}>
              {options.map((option) => {
                const selected = option.value === value;
                return (
                  <TouchableOpacity
                    key={`${option.value ?? "placeholder"}-${option.label}`}
                    activeOpacity={0.75}
                    onPress={() => choose(option.value)}
                    style={[styles.option, selected && styles.selectedOption]}
                  >
                    <Text style={styles.optionText}>{option.label}</Text>
                    {selected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={21}
                        color={COLORS.text}
                        style={styles.checkIcon}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </Pressable>
          </BlurView>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: 56,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "rgba(255, 255, 255, 0.82)",
  },
  disabled: {
    opacity: 0.55,
  },
  fieldText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21,
    paddingRight: 12,
  },
  placeholder: {
    color: COLORS.placeholder,
  },
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
  },
  popup: {
    maxHeight: "75%",
    overflow: "hidden",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 24,
  },
  option: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  selectedOption: {
    backgroundColor: COLORS.selected,
  },
  optionText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 21,
  },
  checkIcon: {
    marginLeft: 12,
  },
});
