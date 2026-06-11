import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Linking,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { API_URL } from '../../constants/config';
import { ordersApi } from '../../api';
import { Order } from '../../types/api';

interface OrderMediaUploadProps {
  order: Order;
  onMediaUpdate: () => void;
  readOnly?: boolean;
  compact?: boolean;
  showHeader?: boolean;  // Whether to show the header in full view
}

interface MediaItem {
  type: 'image' | 'video' | 'link';
  url: string;
  filename?: string;
  title?: string;
  uploaded_at?: string;
}

export const OrderMediaUpload: React.FC<OrderMediaUploadProps> = ({
  order,
  onMediaUpdate,
  readOnly = false,
  compact = false,
  showHeader = true,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);

  const existingMedia = order.ad_media || [];
  // Remove /api from API_URL to get the base domain for media URLs
  const baseUrl = API_URL.replace('/api', '');

  const getAbsoluteUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const pickMedia = async () => {
    // Request permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your media library');
      return;
    }

    // Launch picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      setIsUploading(true);
      
      try {
        for (const asset of result.assets) {
          // Create form data for upload
          const formData = new FormData();
          
          const fileUri = asset.uri;
          const fileType = asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');
          const fileName = asset.fileName || `upload_${Date.now()}.${fileType.split('/')[1]}`;
          
          formData.append('file', {
            uri: fileUri,
            type: fileType,
            name: fileName,
          } as any);

          await ordersApi.uploadMedia(order.id, formData);
        }
        
        Alert.alert('Success', 'Media uploaded successfully');
        onMediaUpdate();
      } catch (error: any) {
        console.error('Upload error:', error);
        Alert.alert('Upload Failed', error.message || 'Failed to upload media');
      } finally {
        setIsUploading(false);
      }
    }
  };

  const addLink = async () => {
    if (!linkUrl.trim()) {
      Alert.alert('Error', 'Please enter a URL');
      return;
    }

    // Basic URL validation
    try {
      new URL(linkUrl);
    } catch {
      Alert.alert('Error', 'Please enter a valid URL');
      return;
    }

    setIsUploading(true);
    
    try {
      await ordersApi.addMediaLink(order.id, {
        url: linkUrl.trim(),
        title: linkTitle.trim() || undefined,
      });
      
      setLinkUrl('');
      setLinkTitle('');
      setShowLinkModal(false);
      Alert.alert('Success', 'Link added successfully');
      onMediaUpdate();
    } catch (error: any) {
      console.error('Add link error:', error);
      Alert.alert('Error', error.message || 'Failed to add link');
    } finally {
      setIsUploading(false);
    }
  };

  const deleteMedia = async (index: number) => {
    Alert.alert(
      'Delete Media',
      'Are you sure you want to delete this media?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingIndex(index);
            try {
              await ordersApi.deleteMedia(order.id, index);
              onMediaUpdate();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete media');
            } finally {
              setDeletingIndex(null);
            }
          },
        },
      ]
    );
  };

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open link');
    });
  };

  const renderMediaThumbnail = (media: MediaItem, index: number) => {
    const isDeleting = deletingIndex === index;

    return (
      <View key={index} style={styles.thumbnail}>
        {media.type === 'image' ? (
          <Image
            source={{ uri: getAbsoluteUrl(media.url) }}
            style={styles.thumbnailImage}
            resizeMode="cover"
          />
        ) : media.type === 'video' ? (
          <View style={[styles.thumbnailImage, styles.videoPlaceholder]}>
            <Ionicons name="play-circle" size={24} color={Colors.white} />
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.thumbnailImage, styles.linkPlaceholder]}
            onPress={() => openLink(media.url)}
          >
            <Ionicons name="link" size={20} color={Colors.accent} />
            <Text style={styles.linkText} numberOfLines={1}>
              {media.title || 'Link'}
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.typeBadge}>
          <Text style={styles.typeBadgeText}>{media.type}</Text>
        </View>

        {!readOnly && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => deleteMedia(index)}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Ionicons name="trash" size={14} color={Colors.white} />
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Compact view for order cards
  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactHeader}>
          <View style={styles.compactHeaderLeft}>
            <Ionicons name="cloud-upload-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.compactLabel}>Ad Media ({existingMedia.length})</Text>
          </View>
          {!readOnly && (
            <View style={styles.compactActions}>
              <TouchableOpacity
                style={styles.compactButton}
                onPress={pickMedia}
                disabled={isUploading}
              >
                {isUploading ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : (
                  <Ionicons name="add" size={16} color={Colors.accent} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.compactButton}
                onPress={() => setShowLinkModal(true)}
              >
                <Ionicons name="link" size={14} color={Colors.accent} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {existingMedia.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.compactThumbnails}>
              {existingMedia.map((media, index) => renderMediaThumbnail(media, index))}
            </View>
          </ScrollView>
        ) : !readOnly ? (
          <TouchableOpacity
            style={styles.compactUploadButton}
            onPress={pickMedia}
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator size="small" color={Colors.accent} />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={16} color={Colors.accent} />
                <Text style={styles.compactUploadText}>Upload Ad Content</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <Text style={styles.emptyText}>No media uploaded</Text>
        )}

        {/* Link Modal */}
        <Modal
          visible={showLinkModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowLinkModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Add Link</Text>
              
              <TextInput
                style={styles.input}
                placeholder="https://..."
                placeholderTextColor={Colors.textMuted}
                value={linkUrl}
                onChangeText={setLinkUrl}
                autoCapitalize="none"
                keyboardType="url"
              />
              
              <TextInput
                style={styles.input}
                placeholder="Title (optional)"
                placeholderTextColor={Colors.textMuted}
                value={linkTitle}
                onChangeText={setLinkTitle}
              />
              
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowLinkModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={addLink}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Text style={styles.addButtonText}>Add Link</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // Full view for order details
  return (
    <View style={styles.container}>
      {showHeader && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="cloud-upload" size={20} color={Colors.accent} />
            <Text style={styles.title}>Your Ad Content</Text>
          </View>
          {!readOnly && (
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={pickMedia}
                disabled={isUploading}
              >
                {isUploading ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <>
                    <Ionicons name="cloud-upload" size={16} color={Colors.white} />
                    <Text style={styles.actionButtonText}>Upload</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.linkActionButton]}
                onPress={() => setShowLinkModal(true)}
              >
                <Ionicons name="link" size={16} color={Colors.accent} />
                <Text style={styles.linkActionButtonText}>Add Link</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
      
      {/* Action buttons when header is hidden */}
      {!showHeader && !readOnly && (
        <View style={styles.inlineActions}>
          <TouchableOpacity
            style={styles.inlineActionButton}
            onPress={pickMedia}
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <Ionicons name="cloud-upload" size={18} color={Colors.white} />
                <Text style={styles.inlineActionButtonText}>Upload</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.inlineActionButtonOutline}
            onPress={() => setShowLinkModal(true)}
          >
            <Ionicons name="link" size={18} color={Colors.accent} />
            <Text style={styles.inlineActionButtonOutlineText}>Add Link</Text>
          </TouchableOpacity>
        </View>
      )}

      {existingMedia.length > 0 ? (
        <View style={styles.mediaGrid}>
          {existingMedia.map((media, index) => renderMediaThumbnail(media, index))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="cloud-upload-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>
            {readOnly ? 'No media uploaded' : 'Upload your ad content'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {readOnly ? '' : 'Photos, videos, or links you want us to advertise'}
          </Text>
          {!readOnly && (
            <TouchableOpacity
              style={styles.emptyUploadButton}
              onPress={pickMedia}
              disabled={isUploading}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={20} color={Colors.white} />
                  <Text style={styles.emptyUploadButtonText}>Upload Files</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Link Modal */}
      <Modal
        visible={showLinkModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLinkModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Link</Text>
            
            <TextInput
              style={styles.input}
              placeholder="https://..."
              placeholderTextColor={Colors.textMuted}
              value={linkUrl}
              onChangeText={setLinkUrl}
              autoCapitalize="none"
              keyboardType="url"
            />
            
            <TextInput
              style={styles.input}
              placeholder="Title (optional)"
              placeholderTextColor={Colors.textMuted}
              value={linkTitle}
              onChangeText={setLinkTitle}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowLinkModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addButton}
                onPress={addLink}
                disabled={isUploading}
              >
                {isUploading ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.addButtonText}>Add Link</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.accent + '30',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: Fonts.weight.semibold,
    color: Colors.textPrimary,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionButtonText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: Fonts.weight.medium,
  },
  linkActionButton: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  linkActionButtonText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: Fonts.weight.medium,
  },
  inlineActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  inlineActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    paddingVertical: 14,
    borderRadius: 10,
  },
  inlineActionButtonText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: Fonts.weight.semibold,
  },
  inlineActionButtonOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.white,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  inlineActionButtonOutlineText: {
    color: Colors.accent,
    fontSize: 15,
    fontWeight: Fonts.weight.semibold,
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
    backgroundColor: Colors.textPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkPlaceholder: {
    backgroundColor: Colors.accent + '10',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  linkText: {
    fontSize: 10,
    color: Colors.accent,
    marginTop: 4,
  },
  typeBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeText: {
    color: Colors.white,
    fontSize: 9,
    fontWeight: Fonts.weight.medium,
  },
  deleteButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: Colors.error,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: Fonts.weight.medium,
    color: Colors.textPrimary,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  emptyUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  emptyUploadButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: Fonts.weight.medium,
  },
  // Compact styles
  compactContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  compactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  compactHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compactLabel: {
    fontSize: 12,
    fontWeight: Fonts.weight.medium,
    color: Colors.textSecondary,
  },
  compactActions: {
    flexDirection: 'row',
    gap: 4,
  },
  compactButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accent + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactThumbnails: {
    flexDirection: 'row',
    gap: 8,
  },
  compactUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.accent,
    borderRadius: 8,
  },
  compactUploadText: {
    fontSize: 12,
    fontWeight: Fonts.weight.medium,
    color: Colors.accent,
  },
  emptyText: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: 8,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: Fonts.weight.semibold,
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    fontWeight: Fonts.weight.regular,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: Fonts.weight.medium,
    color: Colors.textSecondary,
  },
  addButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: Colors.accent,
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: Fonts.weight.medium,
    color: Colors.white,
  },
});

export default OrderMediaUpload;
