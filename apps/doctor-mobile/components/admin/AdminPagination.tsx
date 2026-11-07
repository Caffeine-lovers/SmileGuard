import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";

export const ADMIN_ITEMS_PER_PAGE = 10;

export function getPageNumbers(currentPage: number, totalPages: number): (number | string)[] {
  const pages: (number | string)[] = [];
  if (totalPages <= 5) {
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
  } else {
    if (currentPage <= 3) {
      pages.push(1, 2, 3, 4, "...", totalPages);
    } else if (currentPage >= totalPages - 2) {
      pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
    }
  }
  return pages;
}

export interface AdminCountHeaderProps {
  startIndex: number;
  endIndex: number;
  totalItems: number;
  currentPage: number;
  totalPages: number;
  itemLabel: string;
  filterNote?: string;
  style?: StyleProp<ViewStyle>;
}

export function AdminCountHeader({
  startIndex,
  endIndex,
  totalItems,
  currentPage,
  totalPages,
  itemLabel,
  filterNote,
  style,
}: AdminCountHeaderProps) {
  if (totalItems === 0) return null;

  return (
    <View style={[styles.countHeader, style]}>
      <Text style={styles.countHeaderText} numberOfLines={1}>
        Showing{" "}
        <Text style={styles.countHeaderBold}>
          {totalItems > 0 ? `${startIndex + 1}–${endIndex}` : "0"}
        </Text>{" "}
        of <Text style={styles.countHeaderBold}>{totalItems}</Text> {itemLabel}
        {filterNote ? ` (${filterNote})` : ""}
      </Text>
      {totalPages > 1 && (
        <View style={styles.pageBadge}>
          <Text style={styles.pageBadgeText}>
            Page {currentPage} of {totalPages}
          </Text>
        </View>
      )}
    </View>
  );
}

export interface AdminPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  style?: StyleProp<ViewStyle>;
}

export function AdminPagination({
  currentPage,
  totalPages,
  onPageChange,
  style,
}: AdminPaginationProps) {
  if (totalPages <= 1) return null;

  const pages = getPageNumbers(currentPage, totalPages);

  return (
    <View style={[styles.paginationContainer, style]}>
      {/* Previous Button */}
      <TouchableOpacity
        style={[
          styles.navButton,
          currentPage === 1 && styles.navButtonDisabled,
        ]}
        onPress={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        activeOpacity={0.7}
        accessibilityLabel="Previous Page"
      >
        <ChevronLeft size={18} color={currentPage === 1 ? "#94A3B8" : "#047857"} />
      </TouchableOpacity>

      {/* Page Numbers */}
      <View style={styles.pageNumbersRow}>
        {pages.map((pageNum, index) => {
          if (pageNum === "...") {
            return (
              <View key={`ellipsis-${index}`} style={styles.ellipsisBox}>
                <Text style={styles.ellipsisText}>•••</Text>
              </View>
            );
          }
          const isSelected = pageNum === currentPage;
          return (
            <TouchableOpacity
              key={`page-${pageNum}`}
              style={[
                styles.pageButton,
                isSelected && styles.pageButtonActive,
              ]}
              onPress={() => onPageChange(pageNum as number)}
              activeOpacity={0.7}
              accessibilityLabel={`Page ${pageNum}`}
            >
              <Text
                style={[
                  styles.pageButtonText,
                  isSelected && styles.pageButtonTextActive,
                ]}
              >
                {pageNum}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Next Button */}
      <TouchableOpacity
        style={[
          styles.navButton,
          currentPage === totalPages && styles.navButtonDisabled,
        ]}
        onPress={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        activeOpacity={0.7}
        accessibilityLabel="Next Page"
      >
        <ChevronRight size={18} color={currentPage === totalPages ? "#94A3B8" : "#047857"} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  countHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    paddingHorizontal: 2,
    minHeight: 24,
  },
  countHeaderText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
    flex: 1,
    paddingRight: 8,
  },
  countHeaderBold: {
    color: "#0F172A",
    fontWeight: "700",
  },
  pageBadge: {
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  pageBadgeText: {
    fontSize: 10.5,
    color: "#047857",
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  paginationContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
    marginBottom: 24,
    paddingVertical: 8,
    paddingHorizontal: 6,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1.5,
    borderTopColor: "#FFFFFF",
    borderLeftColor: "#E2E8F0",
    borderRightColor: "#CBD5E1",
    borderBottomColor: "#CBD5E1",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    gap: 6,
    flexWrap: "wrap",
  },
  navButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  navButtonDisabled: {
    backgroundColor: "#F1F5F9",
    borderColor: "#E2E8F0",
  },
  pageNumbersRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  pageButton: {
    minWidth: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderTopColor: "#FFFFFF",
    borderLeftColor: "#E2E8F0",
    borderRightColor: "#CBD5E1",
    borderBottomColor: "#CBD5E1",
  },
  pageButtonActive: {
    backgroundColor: "#047857",
    borderWidth: 1,
    borderColor: "#064E3B",
    borderBottomWidth: 2,
    borderBottomColor: "#022C22",
  },
  pageButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  pageButtonTextActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  ellipsisBox: {
    width: 20,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  ellipsisText: {
    fontSize: 10,
    color: "#94A3B8",
    letterSpacing: 1,
  },
});
