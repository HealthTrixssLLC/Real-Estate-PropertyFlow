import { Feather } from "@expo/vector-icons";
import {
  useListBuyers,
  useCreateBuyer,
  useUpdateBuyer,
  useDeleteBuyer,
  getListBuyersQueryKey,
} from "@workspace/api-client-react";
import type { Buyer } from "@workspace/api-client-react";
import { SymbolView } from "expo-symbols";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

import Colors from "@/constants/colors";

interface BuyerFormState {
  name: string;
  email: string;
  phone: string;
  notes: string;
}

const EMPTY_FORM: BuyerFormState = { name: "", email: "", phone: "", notes: "" };

interface BuyerFormModalProps {
  visible: boolean;
  onClose: () => void;
  initial: Buyer | null;
  onSaved: () => void;
}

function BuyerFormModal({ visible, onClose, initial, onSaved }: BuyerFormModalProps) {
  const scheme = useColorScheme() ?? "light";
  const C = Colors[scheme];
  const isEditing = !!initial;
  const queryClient = useQueryClient();

  const createBuyer = useCreateBuyer();
  const updateBuyer = useUpdateBuyer();

  const [form, setForm] = useState<BuyerFormState>(
    initial
      ? { name: initial.name, email: initial.email ?? "", phone: initial.phone ?? "", notes: initial.notes ?? "" }
      : EMPTY_FORM
  );
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof BuyerFormState) => (val: string) =>
    setForm((f) => ({ ...f, [field]: val }));

  const isPending = createBuyer.isPending || updateBuyer.isPending;

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    setError(null);
    try {
      if (isEditing && initial) {
        await updateBuyer.mutateAsync({
          buyerId: initial.id,
          data: {
            name: form.name.trim(),
            email: form.email.trim() || undefined,
            phone: form.phone.trim() || undefined,
            notes: form.notes.trim() || undefined,
          },
        });
      } else {
        await createBuyer.mutateAsync({
          data: {
            name: form.name.trim(),
            email: form.email.trim() || undefined,
            phone: form.phone.trim() || undefined,
            notes: form.notes.trim() || undefined,
          },
        });
      }
      await queryClient.invalidateQueries({ queryKey: getListBuyersQueryKey() });
      onSaved();
      onClose();
    } catch {
      setError("Something went wrong. Please try again.");
    }
  };

  const handleClose = () => {
    if (!isPending) {
      setError(null);
      onClose();
    }
  };

  React.useEffect(() => {
    if (visible) {
      setForm(
        initial
          ? { name: initial.name, email: initial.email ?? "", phone: initial.phone ?? "", notes: initial.notes ?? "" }
          : EMPTY_FORM
      );
      setError(null);
    }
  }, [visible, initial]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: C.background }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.modalHeader, { borderBottomColor: C.border, backgroundColor: C.surface }]}>
          <Pressable onPress={handleClose} style={styles.modalCancel} disabled={isPending}>
            <Text style={[styles.modalCancelText, { color: isPending ? C.textTertiary : C.accent }]}>Cancel</Text>
          </Pressable>
          <Text style={[styles.modalTitle, { color: C.text }]}>
            {isEditing ? "Edit Buyer" : "Add Buyer"}
          </Text>
          <Pressable onPress={handleSubmit} style={styles.modalSave} disabled={isPending}>
            {isPending ? (
              <ActivityIndicator size="small" color={C.accent} />
            ) : (
              <Text style={[styles.modalSaveText, { color: C.accent }]}>Save</Text>
            )}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
          <View style={[styles.formSection, { backgroundColor: C.surface, borderColor: C.border }]}>
            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>Full Name *</Text>
              <TextInput
                style={[styles.fieldInput, { color: C.text }]}
                value={form.name}
                onChangeText={set("name")}
                placeholder="Jane Smith"
                placeholderTextColor={C.textTertiary}
                autoFocus
              />
            </View>
            <View style={[styles.fieldDivider, { backgroundColor: C.border }]} />
            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>Email</Text>
              <TextInput
                style={[styles.fieldInput, { color: C.text }]}
                value={form.email}
                onChangeText={set("email")}
                placeholder="jane@example.com"
                placeholderTextColor={C.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View style={[styles.fieldDivider, { backgroundColor: C.border }]} />
            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>Phone</Text>
              <TextInput
                style={[styles.fieldInput, { color: C.text }]}
                value={form.phone}
                onChangeText={set("phone")}
                placeholder="+1 (555) 000-0000"
                placeholderTextColor={C.textTertiary}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <View style={[styles.formSection, { backgroundColor: C.surface, borderColor: C.border }]}>
            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>Notes</Text>
              <TextInput
                style={[styles.fieldInput, styles.notesInput, { color: C.text }]}
                value={form.notes}
                onChangeText={set("notes")}
                placeholder="Preferences, budget, priorities..."
                placeholderTextColor={C.textTertiary}
                multiline
                numberOfLines={4}
              />
            </View>
          </View>

          {error && (
            <Text style={styles.errorText}>{error}</Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface BuyerRowProps {
  buyer: Buyer;
  onEdit: () => void;
  onDelete: () => void;
}

function BuyerRow({ buyer, onEdit, onDelete }: BuyerRowProps) {
  const scheme = useColorScheme() ?? "light";
  const C = Colors[scheme];
  const isIOS = Platform.OS === "ios";

  return (
    <Pressable
      onPress={() => router.push(`/buyers/${buyer.id}`)}
      style={({ pressed }) => [
        styles.buyerRow,
        { backgroundColor: C.surface, borderColor: C.border },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={[styles.buyerAvatar, { backgroundColor: C.accent + "20" }]}>
        <Text style={[styles.buyerInitial, { color: C.accent }]}>
          {buyer.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.buyerInfo}>
        <Text style={[styles.buyerName, { color: C.text }]}>{buyer.name}</Text>
        {buyer.email && (
          <Text style={[styles.buyerDetail, { color: C.textSecondary }]} numberOfLines={1}>
            {buyer.email}
          </Text>
        )}
        {buyer.phone && (
          <Text style={[styles.buyerDetail, { color: C.textSecondary }]} numberOfLines={1}>
            {buyer.phone}
          </Text>
        )}
        {buyer.notes && (
          <Text style={[styles.buyerNotes, { color: C.textTertiary }]} numberOfLines={2}>
            {buyer.notes}
          </Text>
        )}
      </View>
      <View style={styles.buyerActions}>
        <Pressable
          onPress={(e) => { e.stopPropagation?.(); onEdit(); }}
          style={({ pressed }) => [styles.actionBtn, { backgroundColor: C.surfaceAlt }, pressed && { opacity: 0.7 }]}
        >
          {isIOS ? (
            <SymbolView name="pencil" tintColor={C.textSecondary} size={16} />
          ) : (
            <Feather name="edit-2" size={16} color={C.textSecondary} />
          )}
        </Pressable>
        <Pressable
          onPress={(e) => { e.stopPropagation?.(); onDelete(); }}
          style={({ pressed }) => [styles.actionBtn, { backgroundColor: "#FDECEC" }, pressed && { opacity: 0.7 }]}
        >
          {isIOS ? (
            <SymbolView name="trash" tintColor="#E85D4A" size={16} />
          ) : (
            <Feather name="trash-2" size={16} color="#E85D4A" />
          )}
        </Pressable>
        {isIOS ? (
          <SymbolView name="chevron.right" tintColor={C.textTertiary} size={14} />
        ) : (
          <Feather name="chevron-right" size={14} color={C.textTertiary} />
        )}
      </View>
    </Pressable>
  );
}

export default function BuyersScreen() {
  const scheme = useColorScheme() ?? "light";
  const C = Colors[scheme];
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const isIOS = Platform.OS === "ios";
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useListBuyers();
  const deleteBuyer = useDeleteBuyer();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Buyer | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListBuyersQueryKey() });

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (b: Buyer) => {
    setEditing(b);
    setFormOpen(true);
  };

  const handleDelete = (buyer: Buyer) => {
    Alert.alert(
      "Delete Buyer",
      `Are you sure you want to delete ${buyer.name}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteBuyer.mutateAsync({ buyerId: buyer.id });
              await invalidate();
            } catch {
              Alert.alert("Error", "Failed to delete buyer. Please try again.");
            }
          },
        },
      ]
    );
  };

  const topPad = isWeb ? 67 : insets.top;
  const buyers = data?.buyers ?? [];

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Text style={[styles.title, { color: C.text }]}>Buyers</Text>
        <Pressable
          onPress={openAdd}
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: C.accent },
            pressed && { opacity: 0.85 },
          ]}
        >
          {isIOS ? (
            <SymbolView name="plus" tintColor="#FFFFFF" size={18} />
          ) : (
            <Feather name="plus" size={18} color="#FFFFFF" />
          )}
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={C.accent} />
        </View>
      ) : (
        <FlatList
          data={buyers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: isWeb ? 34 : insets.bottom + 16 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={C.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              {isIOS ? (
                <SymbolView name="person.2" tintColor={C.textTertiary} size={48} />
              ) : (
                <Feather name="users" size={48} color={C.textTertiary} />
              )}
              <Text style={[styles.emptyTitle, { color: C.text }]}>No buyers yet</Text>
              <Text style={[styles.emptyText, { color: C.textSecondary }]}>
                Tap the + button to add your first buyer
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <BuyerRow
              buyer={item}
              onEdit={() => openEdit(item)}
              onDelete={() => handleDelete(item)}
            />
          )}
        />
      )}

      <BuyerFormModal
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        initial={editing}
        onSaved={invalidate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  empty: {
    alignItems: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    maxWidth: 240,
  },
  buyerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
  },
  buyerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  buyerInitial: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  buyerInfo: {
    flex: 1,
    gap: 2,
  },
  buyerName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  buyerDetail: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  buyerNotes: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  buyerActions: {
    flexDirection: "row",
    gap: 6,
    flexShrink: 0,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalCancel: { minWidth: 60 },
  modalCancelText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  modalSave: { minWidth: 60, alignItems: "flex-end" },
  modalSaveText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  formScroll: {
    padding: 16,
    gap: 16,
  },
  formSection: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  formField: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldInput: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    padding: 0,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  fieldDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#E85D4A",
    textAlign: "center",
    marginTop: 4,
  },
});
