import { useActionSheet } from '@expo/react-native-action-sheet';
import { FontAwesome } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import moment from 'moment';
import type React from 'react';
import {
  Image,
  RefreshControl,
  Share,
  StyleSheet,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native';

import { patterns } from './PostPatterns';
import { Text } from './nativewindui/Text';

import type { ForumPost } from '~/lib/types';
import { supabase } from '~/utils/supabase';

// Define the label categories
const LABEL_CATEGORIES = [
  'Help Required',
  'New Idea',
  'Looking for Team',
  'Needs Feedback',
  'Discussion',
  'Resource Sharing',
  'Question',
  'Tutorial',
  'Success Story',
  'Open Ended Discussion',
  'Professor Input Needed',
  'Student Project',
  'Other',
];

type ForumPostsListProps = {
  posts: ForumPost[];
  isLoading: boolean;
  error: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  userId?: string;
};

const ForumPostsList: React.FC<ForumPostsListProps> = ({
  posts,
  isLoading,
  error,
  refreshing,
  onRefresh,
  userId,
}) => {
  const { showActionSheetWithOptions } = useActionSheet();
  const router = useRouter();

  const postsByLabel = LABEL_CATEGORIES.reduce(
    (acc, label) => {
      acc[label] = posts.filter((post) => post.label === label);
      return acc;
    },
    {} as Record<string, ForumPost[]>
  );

  const calculateReadTime = (content: string): string => {
    if (!content) return '< 1 min read';
    const words = content.trim().split(/\s+/).length;
    const minutes = Math.ceil(words / 200);
    return `${minutes} min read`;
  };

  const determineBackgroundColor = (post: ForumPost): string => {
    const readTime = post.content ? post.content.trim().split(/\s+/).length / 200 : 0;

    if (post.likesCount >= 10) return '#D2FF1F'; // High likes
    if (readTime > 5) return '#FF825C'; // Long read
    if (post.label === 'New Idea' || post.label === 'Success Story') return '#DCC1FF'; // Special tags
    if (post.label === 'Help Required' || post.label === 'Needs Feedback') return '#FFE078'; // Help tags

    return '#DFFC6B'; // Default color
  };

  const getSvgBackground = (index: number) => {
    const PatternComponent = patterns[index % patterns.length];
    return (
      <View style={styles.svgContainer}>
        <PatternComponent opacity={0.15} />
      </View>
    );
  };

  const handleLongPress = (post: ForumPost) => {
    const options = ['Like', 'Share', 'Cancel'];
    const destructiveButtonIndex = 2;
    showActionSheetWithOptions({ options, destructiveButtonIndex }, (index) => {
      if (index === 0) {
        toggleLike(post.id);
      } else if (index === 1) {
        Share.share({
          title: post.title,
          message: `Check out this post: ${post.title} https://ideaclinic-forum.vercel.app/forum/post/${post.id}`,
          url: `https://ideaclinic-forum.vercel.app/forum/post/${post.id}`,
        }).catch((err) => console.error('Error sharing:', err));
      }
    });
  };

  // Add like toggle function
  const toggleLike = async (postId: string) => {
    if (!userId) {
      ToastAndroid.show('Please login to like posts', ToastAndroid.SHORT);
      return;
    }

    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    const isLiked = post.likes?.includes(userId);

    try {
      const { data: currentPost } = await supabase
        .from('posts')
        .select('likes')
        .eq('id', postId)
        .single();

      const currentLikes = currentPost?.likes || [];
      let newLikes: string[];

      if (isLiked) {
        newLikes = currentLikes.filter((id) => id !== userId);
      } else {
        newLikes = [...currentLikes, userId];
      }

      newLikes = newLikes.filter((id): id is string => id !== undefined);

      const { error } = await supabase.from('posts').update({ likes: newLikes }).eq('id', postId);

      if (error) throw error;

      onRefresh();
    } catch (err) {
      console.error('Error updating like:', err);
      ToastAndroid.show('Failed to update like', ToastAndroid.SHORT);
    }
  };

  const renderPostCard = ({ item, index }: { item: ForumPost; index: number }) => (
    <TouchableOpacity
      style={[styles.cardContainer, { backgroundColor: determineBackgroundColor(item) }]}
      onPress={() => router.push(`/post/${item.id}`)}
      onLongPress={() => handleLongPress(item)}>
      <View className="relative p-3">
        {/* SVG Background */}
        {getSvgBackground(index)}

        {/* Content Container */}
        <View style={styles.contentContainer}>
          {/* Top row with title and like button */}
          <View className="flex-row justify-between">
            <Text className="flex-1 text-lg font-bold">{item.title}</Text>
            <View className="flex-row items-center">
              <TouchableOpacity
                className="mr-1"
                onPress={() => toggleLike(item.id)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <FontAwesome
                  name={item.isLiked ? 'heart' : 'heart-o'}
                  size={20}
                  color={item.isLiked ? '#FF4444' : '#666666'}
                />
              </TouchableOpacity>
              <Text className="text-xs">{item.likesCount}</Text>
            </View>
          </View>
          <Text className="ml-0.5 text-xs text-gray-600">
            {moment(item.created_at).format('MMM D, YYYY')}
          </Text>

          {/* Mid section - reduced height */}
          <View className="mb-2 mt-2 min-h-[80px]" />

          {/* Tag */}
          <View className="flex-row items-center justify-between">
            <View
              className="rounded-full px-2 py-1"
              style={{ backgroundColor: `${item.label_color}30` }}>
              <Text style={{ color: item.label_color }} className="text-xs font-medium">
                {item.label}
              </Text>
            </View>
          </View>

          {/* Author and read time */}
          <View className="mt-3 flex-row items-center justify-between">
            <View className="flex-row items-center">
              {item.creator?.avatar_url && (
                <Image source={{ uri: item.creator.avatar_url }} className="h-6 w-6 rounded-full" />
              )}
              <Text className="ml-2 text-xs">{item.creator?.full_name || 'Unknown'}</Text>
            </View>

            {/* Read time with clock icon */}
            <View className="flex-row items-center">
              <FontAwesome name="clock-o" size={12} color="#666" />
              <Text className="ml-1 text-xs text-gray-500">
                {calculateReadTime(item.content || '')}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  // Render section for each label category
  const renderLabelSection = (label: string) => {
    const labelPosts = postsByLabel[label] || [];

    if (labelPosts.length === 0) return null;

    return (
      <View className="mb-4" key={label}>
        <Text className="mb-2 ml-4 text-lg font-bold">{label}</Text>
        <FlashList
          data={labelPosts}
          renderItem={renderPostCard}
          estimatedItemSize={250}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
        />
      </View>
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>Loading posts...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>Error: {error}</Text>
      </View>
    );
  }

  return (
    <FlashList
      data={[...LABEL_CATEGORIES, 'all']}
      renderItem={({ item }) => {
        if (item === 'all') {
          return (
            <View className="mt-4">
              <Text className="mb-2 ml-4 text-xl font-bold">All Posts</Text>
              <FlashList
                data={posts}
                renderItem={renderPostCard}
                estimatedItemSize={250}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.verticalList}
                numColumns={1}
              />
            </View>
          );
        }
        return renderLabelSection(item);
      }}
      estimatedItemSize={350}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    />
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: 15,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    width: 300,
    marginHorizontal: 4,
    overflow: 'hidden', // Ensure SVG doesn't overflow the card
  },
  svgContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: -50 }],
    zIndex: 1,
    width: 224, // Match SVG viewBox width
    height: 158, // Match SVG viewBox height
    alignItems: 'center',
    justifyContent: 'center',
  },
  svgBackground: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain', // Prevent repetition
  },
  contentContainer: {
    position: 'relative',
    zIndex: 2, // Ensure content appears above SVG
  },
  horizontalList: {
    paddingHorizontal: 8,
  },
  verticalList: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
});

export default ForumPostsList;
