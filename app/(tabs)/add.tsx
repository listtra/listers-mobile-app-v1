import { useAuth } from "@/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView as SafeAreaViewContext } from "react-native-safe-area-context";

// Constants for form validation and dropdown options
const CATEGORIES = [
  "Electronics",
  "Mobile Phones",
  "Computers & Accessories",
  "Fashion",
  "Men's Clothing",
  "Women's Clothing",
  "Shoes",
  "Accessories",
  "Home & Garden",
  "Furniture",
  "Kitchen & Dining",
  "Home Decor",
  "Books & Media",
  "Books",
  "Music",
  "Movies",
  "Video Games",
  "Sports & Outdoors",
  "Sporting Goods",
  "Outdoor Recreation",
  "Exercise Equipment",
  "Toys & Hobbies",
  "Toys",
  "Collectibles",
  "Arts & Crafts",
  "Beauty & Health",
  "Makeup",
  "Skincare",
  "Health Equipment",
  "Vehicles",
  "Cars",
  "Motorcycles",
  "Bicycles",
  "Auto Parts",
  "Services",
  "Other",
];

const CONDITIONS = [
  "new",
  "like_new",
  "lightly_used",
  "well_used",
  "heavily_used",
];

const MAX_IMAGES = 5;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

export default function AddItem() {
  const router = useRouter();
  const { user, tokens: { accessToken } } = useAuth();

  // Step management
  const [currentStep, setCurrentStep] = useState(1);

  // Add state for WebView reference
  const [webViewRef, setWebViewRef] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    category: CATEGORIES[0],
    condition: CONDITIONS[0],
    location: "",
  });

  // Image handling state
  const [images, setImages] = useState<string[]>([]);
  const [mainImageIndex, setMainImageIndex] = useState(0);
  const [isPickingImage, setIsPickingImage] = useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // Loading state
  const [isLoading, setIsLoading] = useState(false);

  // Add state for dropdown visibility
  const [categoryDropdownVisible, setCategoryDropdownVisible] = useState(false);
  const [conditionDropdownVisible, setConditionDropdownVisible] =
    useState(false);

  // Reset form when the component is focused again
  useFocusEffect(
    useCallback(() => {
      // This function will run when the screen comes into focus
      const resetForm = () => {
        // Reset to first page
        setCurrentStep(1);

        // Reset form data
        setFormData({
          title: "",
          description: "",
          price: "",
          category: CATEGORIES[0],
          condition: CONDITIONS[0],
          location: "",
        });

        // Reset images
        setImages([]);
        setMainImageIndex(0);

        // Clear errors
        setFormErrors({});
      };

      // Reset the form when component is focused
      resetForm();

      // No cleanup function needed
      return () => {};
    }, [])
  );

  useEffect(() => {
    // Only request media permissions
    requestMediaLibraryPermissions();
  }, []);

  // Add a safety guard for navigation
  useEffect(() => {
    // If we're on step 2 or beyond and no images, force back to step 1
    if (currentStep > 1 && images.length === 0) {
      console.log("Safety check: No images, resetting to step 1");
      setCurrentStep(1);
      // Show alert after a small delay to ensure it's visible
      setTimeout(() => {
        Alert.alert(
          "Images Required",
          "At least one image is required. Please select an image to continue.",
          [{ text: "OK" }]
        );
      }, 100);
    }
  }, [images, currentStep]);

  // Request permissions for photo library access
  const requestMediaLibraryPermissions = async () => {
    if (Platform.OS !== "web") {
      setIsLoading(true);
      try {
        const { status } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Permission Needed",
            "We need permission to access your photo library so you can select images for your listings.",
            [{ text: "OK" }]
          );
        }
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Handle input changes
  const handleInputChange = (field: string, value: string) => {
    // Special handling for price field - only allow numbers and decimal
    if (field === "price") {
      // Validate price input (numbers and one decimal point only)
      if (value === "" || /^\d+(\.\d{0,2})?$/.test(value)) {
        setFormData({ ...formData, [field]: value });
      }
      return;
    }

    setFormData({ ...formData, [field]: value });

    // Clear error when field is being edited
    if (formErrors[field]) {
      const newErrors = { ...formErrors };
      delete newErrors[field];
      setFormErrors(newErrors);
    }
  };

  // Pick image from gallery
  const pickImage = async () => {
    if (images.length >= MAX_IMAGES) {
      Alert.alert(
        "Maximum Images",
        `You can only upload up to ${MAX_IMAGES} images`
      );
      return;
    }

    setIsPickingImage(true);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        aspect: [4, 3],
        quality: 0.8,
        base64: false,
        allowsMultipleSelection: true,
        selectionLimit: MAX_IMAGES - images.length,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        // Handle multiple selections
        const newImages = [...images];
        let sizeExceeded = false;
        let imagesAdded = 0;

        // Process each selected asset
        for (const selectedAsset of result.assets) {
          // Check file size if available
          if (
            selectedAsset.fileSize &&
            selectedAsset.fileSize > MAX_IMAGE_SIZE
          ) {
            sizeExceeded = true;
            continue;
          }

          // Add the image if we haven't hit the limit
          if (newImages.length < MAX_IMAGES) {
            newImages.push(selectedAsset.uri);
            imagesAdded++;
          }
        }

        // Update images state
        setImages(newImages);

        // If this is the first image, make it the main image
        if (images.length === 0 && newImages.length > 0) {
          setMainImageIndex(0);
        }

        // Show appropriate feedback
        if (imagesAdded > 0) {
          if (sizeExceeded) {
            Alert.alert(
              "Some Images Added",
              `Added ${imagesAdded} photo${
                imagesAdded > 1 ? "s" : ""
              }. Some images were skipped because they exceeded the 5MB size limit.`
            );
          } else if (newImages.length === MAX_IMAGES) {
            Alert.alert(
              "Maximum Images",
              `You've reached the maximum of ${MAX_IMAGES} images.`
            );
          }
        } else if (sizeExceeded) {
          Alert.alert(
            "Images Too Large",
            "All selected images exceeded the 5MB size limit. Please select smaller images."
          );
        }
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to select images. Please try again.");
    } finally {
      setIsPickingImage(false);
    }
  };

  // Remove an image
  const removeImage = (index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    setImages(newImages);

    // Update main image index if needed
    if (mainImageIndex === index) {
      // If we removed the main image, set the first available image as main
      setMainImageIndex(newImages.length > 0 ? 0 : -1);
    } else if (mainImageIndex > index) {
      // If we removed an image before the main image, adjust the index
      setMainImageIndex(mainImageIndex - 1);
    }
  };

  // Set main image
  const setMainImage = (index: number) => {
    setMainImageIndex(index);
  };

  // Validate form
  const validateForm = () => {
    const errors: { [key: string]: string } = {};

    if (!formData.title.trim()) {
      errors.title = "Title is required";
    }

    if (!formData.description.trim()) {
      errors.description = "Description is required";
    }

    if (!formData.price) {
      errors.price = "Price is required";
    } else if (
      isNaN(parseFloat(formData.price)) ||
      parseFloat(formData.price) <= 0
    ) {
      errors.price = "Price must be a positive number";
    }

    if (!formData.location.trim()) {
      errors.location = "Location is required";
    }

    if (images.length === 0) {
      errors.images = "At least one image is required";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Token validation
  const validateToken = async () => {
    if (!accessToken) {
      Alert.alert(
        "Authentication Error",
        "You need to be logged in to create a listing. Please log in and try again.",
        [
          {
            text: "OK",
            onPress: () => {
              router.push('/(auth)/login' as any);
            },
          },
        ]
      );
      return false;
    }
    return true;
  };

  // Submit form
  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Validate token before proceeding
      if (!await validateToken()) {
        setIsSubmitting(false);
        return;
      }

      // Create FormData for multipart/form-data submission
      const formDataToSend = new FormData();
      formDataToSend.append("title", formData.title);
      formDataToSend.append("description", formData.description);
      formDataToSend.append("price", formData.price);
      formDataToSend.append("condition", formData.condition);
      formDataToSend.append("location", formData.location);

      // Generate a slug from the title
      const slug = formData.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric chars with hyphens
        .replace(/(^-|-$)/g, "") // Remove leading/trailing hyphens
        .slice(0, 25); // Limit to 25 characters
      formDataToSend.append("slug", slug);

      // Append all images
      images.forEach((imageUri, index) => {
        const filename = imageUri.split("/").pop() || `image-${index}.jpg`;
        // In React Native, we need to use a special format for FormData
        // @ts-ignore - React Native specific FormData format
        formDataToSend.append("images", {
          uri: imageUri,
          name: filename,
          type: "image/jpeg",
        });
      });

      // Make the API request
      const response = await axios.post(
        "https://backend.listtra.com/api/listings/create/",
        formDataToSend,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.status === 201) {
        Alert.alert(
          "Success",
          "Your listing has been created successfully!",
          [
            {
              text: "OK",
              onPress: () => {
                router.push('/(tabs)/listings' as any);
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error("Error creating listing:", error);
      Alert.alert(
        "Error",
        "Failed to create listing. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Custom Dropdown component
  interface CustomDropdownProps {
    label: string;
    options: string[];
    selectedValue: string;
    onValueChange: (value: string) => void;
    isVisible: boolean;
    setIsVisible: (isVisible: boolean) => void;
  }

  const formatConditionDisplay = (condition: string) => {
    return condition
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const CustomDropdown = ({
    label,
    options,
    selectedValue,
    onValueChange,
    isVisible,
    setIsVisible,
  }: CustomDropdownProps) => {
    return (
      <>
        <TouchableOpacity
          style={styles.dropdownButton}
          onPress={() => setIsVisible(true)}
        >
          <Text style={styles.dropdownButtonText}>
            {label === "Condition"
              ? formatConditionDisplay(selectedValue)
              : selectedValue}
          </Text>
          <Ionicons name="chevron-down" size={20} color="#777" />
        </TouchableOpacity>

        <Modal
          transparent={true}
          visible={isVisible}
          animationType="fade"
          onRequestClose={() => setIsVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setIsVisible(false)}
          >
            <View style={styles.dropdownModal}>
              <Text style={styles.dropdownModalTitle}>{`Select ${label}`}</Text>

              <ScrollView>
                {options.map((option: string) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.dropdownItem,
                      selectedValue === option && styles.selectedDropdownItem,
                    ]}
                    onPress={() => {
                      onValueChange(option);
                      setIsVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        selectedValue === option &&
                          styles.selectedDropdownItemText,
                      ]}
                    >
                      {label === "Condition"
                        ? formatConditionDisplay(option)
                        : option}
                    </Text>
                    {selectedValue === option && (
                      <Ionicons name="checkmark" size={20} color="#0066CC" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      </>
    );
  };

  // If loading permissions
  if (isLoading) {
    return (
      <SafeAreaViewContext style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066CC" />
        <Text style={styles.loadingText}>Preparing...</Text>
      </SafeAreaViewContext>
    );
  }

  return (
    <SafeAreaViewContext style={styles.container} edges={["top", "bottom"]}>
      <StatusBar style="dark" />

      {currentStep === 1 && (
        // Step 1: New Add Item First Page
        <View style={styles.firstPageContainer}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>New Post</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.uploadContainer}>
            <TouchableOpacity
              style={styles.mainUploadButton}
              onPress={pickImage}
            >
              <Ionicons name="images" size={32} color="#666" />
              <Text style={styles.uploadText}>Select Photos</Text>
              <Text style={styles.uploadSubText}>Choose up to 5 images</Text>
            </TouchableOpacity>

            <View style={styles.imagePreviewHeader}>
              <Text style={styles.previewTitle}>
                {images.length > 0
                  ? "Selected Photos"
                  : "No photos selected yet"}
              </Text>
              <Text style={styles.imageCounterText}>
                {images.length}/{MAX_IMAGES} Photos
              </Text>
            </View>

            {images.length > 0 ? (
              <ScrollView
                horizontal
                style={styles.thumbnailScroll}
                showsHorizontalScrollIndicator={false}
              >
                {images.map((uri, index) => (
                  <View key={index} style={styles.thumbnailContainer}>
                    <Image source={{ uri }} style={styles.thumbnail} />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => removeImage(index)}
                    >
                      <Ionicons name="close-circle" size={20} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </View>

          <View style={styles.divider} />

          <View style={styles.bottomButtonContainer}>
            {images.length > 0 ? (
              <TouchableOpacity
                style={styles.nextPageButton}
                onPress={() => setCurrentStep(2)}
              >
                <Text style={styles.nextPageButtonText}>Next</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.nextPageButton, styles.disabledButton]}
                onPress={() => {
                  Alert.alert(
                    "Images Required",
                    "You must select at least one image before continuing.",
                    [{ text: "OK" }]
                  );
                }}
              >
                <Text style={styles.nextPageButtonText}>Next</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {currentStep === 2 && (
        // Step 2: Image Preview and Navigation
        <View style={styles.secondPageContainer} className="mb-16">
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => setCurrentStep(1)}
              style={styles.backButton}
            >
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Preview</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Main large image preview */}
          <View style={styles.mainImageContainer}>
            {images.length > 0 ? (
              <View style={styles.mainImageWrapper}>
                <Image
                  source={{ uri: images[mainImageIndex] }}
                  style={styles.mainImage}
                  resizeMode="contain"
                />
              </View>
            ) : (
              <View style={styles.noImagePlaceholder}>
                <Ionicons name="image-outline" size={80} color="#CCCCCC" />
                <Text style={styles.noImageText}>No images selected</Text>
              </View>
            )}
          </View>

          {/* Footer with thumbnails and action buttons */}
          <View style={styles.previewFooter}>
            {/* Thumbnail row */}
            <ScrollView
              horizontal
              style={styles.previewThumbnailRow}
              showsHorizontalScrollIndicator={false}
            >
              {images.map((uri, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.previewThumbnail,
                    mainImageIndex === index && styles.selectedPreviewThumbnail,
                  ]}
                  onPress={() => setMainImage(index)}
                >
                  <Image source={{ uri }} style={styles.thumbnailImage} />
                  <TouchableOpacity
                    style={styles.removeThumbnailButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      removeImage(index);
                    }}
                  >
                    <Ionicons name="close-circle" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Action buttons */}
            <View style={styles.previewActionButtons}>
              <TouchableOpacity style={styles.cameraButton} onPress={pickImage}>
                <Ionicons name="camera" size={24} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.nextStepButton}
                onPress={() => {
                  // Double-check we have images before proceeding
                  if (images.length === 0) {
                    Alert.alert(
                      "Images Required",
                      "You must select at least one image before continuing.",
                      [{ text: "OK" }]
                    );
                    // Force back to step 1
                    setCurrentStep(1);
                    return;
                  }
                  setCurrentStep(3);
                }}
              >
                <Text style={styles.nextStepButtonText}>Next</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {currentStep === 3 && (
        // Step 3: Item Details (Title, Description, Price)
        <>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Item Details</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollViewContent}
            showsVerticalScrollIndicator={false}
            className="mb-12"
          >
            {/* Images preview row (view only) */}
            {images.length > 0 && (
              <View style={styles.thirdPageImagesContainer}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.thirdPageImagesScroll}
                >
                  {images.map((uri, index) => (
                    <View
                      key={index}
                      style={[
                        styles.thirdPageImageWrapper,
                        index === mainImageIndex &&
                          styles.thirdPageMainImageWrapper,
                      ]}
                    >
                      <Image source={{ uri }} style={styles.thirdPageImage} />
                      {index === mainImageIndex && (
                        <View style={styles.mainImageBadge}>
                          <Text style={styles.mainImageBadgeText}>Main</Text>
                        </View>
                      )}
                    </View>
                  ))}
                </ScrollView>
                <Text style={styles.imageCounterText}>
                  {images.length} {images.length === 1 ? "Photo" : "Photos"}
                </Text>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Title*</Text>
              <TextInput
                style={[
                  styles.input,
                  formErrors.title ? styles.inputError : null,
                ]}
                placeholder="What are you selling?"
                value={formData.title}
                onChangeText={(value) => handleInputChange("title", value)}
                maxLength={100}
              />
              {formErrors.title && (
                <Text style={styles.errorText}>{formErrors.title}</Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description*</Text>
              <TextInput
                style={[
                  styles.textArea,
                  formErrors.description ? styles.inputError : null,
                ]}
                placeholder="Describe your item (condition, features, etc.)"
                value={formData.description}
                onChangeText={(value) =>
                  handleInputChange("description", value)
                }
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              {formErrors.description && (
                <Text style={styles.errorText}>{formErrors.description}</Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Price (₹)*</Text>
              <View style={styles.priceInputContainer}>
                <Text style={styles.currencySymbolSmall}>₹</Text>
                <TextInput
                  style={[
                    styles.input,
                    formErrors.price ? styles.inputError : null,
                  ]}
                  placeholder="0.00"
                  value={formData.price}
                  onChangeText={(value) => handleInputChange("price", value)}
                  keyboardType="decimal-pad"
                />
              </View>
              {formErrors.price && (
                <Text style={styles.errorText}>{formErrors.price}</Text>
              )}
              <Text style={styles.priceSuggestionTextSmall}>
                Similar items are priced between ₹500 - ₹2,000
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Condition*</Text>
              <View style={styles.pickerContainer}>
                <CustomDropdown
                  label="Condition"
                  options={CONDITIONS}
                  selectedValue={formData.condition}
                  onValueChange={(value: string) =>
                    handleInputChange("condition", value)
                  }
                  isVisible={conditionDropdownVisible}
                  setIsVisible={setConditionDropdownVisible}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Pickup Location*</Text>
              <TextInput
                style={[
                  styles.input,
                  formErrors.location ? styles.inputError : null,
                ]}
                placeholder="Where can buyers pick this up?"
                value={formData.location}
                onChangeText={(value) => handleInputChange("location", value)}
              />
              {formErrors.location && (
                <Text style={styles.errorText}>{formErrors.location}</Text>
              )}
            </View>

            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.submitButtonText}>List</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </>
      )}

      {currentStep === 4 && (
        // Step 4: Success Screen
        <View style={styles.successContainer}>
          <View style={styles.successContent}>
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark-circle" size={80} color="#4BB543" />
            </View>
            <Text style={styles.successTitle}>Listed Successfully!</Text>
            <Text style={styles.successMessage}>
              Your item has been listed and is now visible to potential buyers.
            </Text>

            <TouchableOpacity
              style={styles.exploreButton}
              onPress={() => {
                router.push('/(tabs)/listings' as any);
              }}
            >
              <Text style={styles.exploreButtonText}>View Listings</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaViewContext>
  );
}

const windowWidth = Dimensions.get("window").width;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
    backgroundColor: "#FFFFFF",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    ...Platform.select({
      ios: {
        fontWeight: "600",
      },
      android: {
        fontWeight: "700",
      },
    }),
    color: "#333333",
  },
  nextButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  nextButtonText: {
    color: "#0066CC",
    fontSize: 16,
    fontWeight: "bold",
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 16,
    paddingBottom: 40,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 8,
    color: "#333333",
  },
  input: {
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#FAFAFA",
  },
  inputError: {
    borderColor: "#FF3B30",
  },
  errorText: {
    color: "#FF3B30",
    fontSize: 14,
    marginTop: 4,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 8,
    backgroundColor: "#FAFAFA",
    overflow: "hidden",
  },
  dropdownButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  dropdownButtonText: {
    fontSize: 16,
    color: "#333",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  dropdownModal: {
    width: "80%",
    maxHeight: "60%",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  dropdownModalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#333",
    textAlign: "center",
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  selectedDropdownItem: {
    backgroundColor: "#F0F7FF",
  },
  dropdownItemText: {
    fontSize: 16,
    color: "#333",
  },
  selectedDropdownItemText: {
    color: "#0066CC",
    fontWeight: "500",
  },
  submitButton: {
    backgroundColor: "#0066CC",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 20,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#0066CC",
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 16,
  },

  // Updated styles for first page
  firstPageContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  uploadContainer: {
    padding: 20,
  },
  mainUploadButton: {
    width: "100%",
    height: 180,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderStyle: "dashed",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9F9F9",
    marginBottom: 16,
  },
  uploadText: {
    fontSize: 18,
    fontWeight: "500",
    color: "#333333",
    marginTop: 8,
  },
  uploadSubText: {
    fontSize: 14,
    color: "#999999",
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  imagePreviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333333",
  },
  imageCounterText: {
    fontSize: 14,
    color: "#999999",
  },
  thumbnailScroll: {
    flexDirection: "row",
    marginBottom: 16,
  },
  thumbnailContainer: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginRight: 10,
    position: "relative",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#EEEEEE",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  removeImageButton: {
    position: "absolute",
    top: 5,
    right: 5,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderRadius: 15,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  divider: {
    height: 8,
    backgroundColor: "#F2F2F2",
    width: "100%",
  },
  inputArea: {
    padding: 20,
    flex: 1,
  },
  titleInput: {
    fontSize: 18,
    borderBottomWidth: 1,
    borderColor: "#EEEEEE",
    paddingVertical: 12,
    marginBottom: 16,
  },
  descriptionInput: {
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: "top",
    paddingTop: 12,
  },

  // Bottom button styles
  bottomButtonContainer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
  },
  nextPageButton: {
    backgroundColor: "#0066CC",
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
  },
  disabledButton: {
    backgroundColor: "#CCCCCC",
  },
  nextPageButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },

  // Styles for the new image preview page (step 2)
  secondPageContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  mainImageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
  },
  mainImageWrapper: {
    width: "100%",
    height: "100%",
    position: "relative",
  },
  mainImage: {
    width: "100%",
    height: "100%",
  },
  removeMainImageButton: {
    position: "absolute",
    top: 16,
    right: 16,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  noImagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  noImageText: {
    fontSize: 18,
    color: "#999999",
    marginTop: 16,
  },
  previewFooter: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
    paddingVertical: 10,
  },
  previewThumbnailRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  previewThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 4,
    marginRight: 8,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
    position: "relative",
  },
  selectedPreviewThumbnail: {
    borderColor: "#0066CC",
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
  },
  previewActionButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  cameraButton: {
    backgroundColor: "#666666",
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  nextStepButton: {
    backgroundColor: "#0066CC",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  nextStepButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
    marginRight: 8,
  },
  textArea: {
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#FAFAFA",
    minHeight: 100,
  },
  priceInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 8,
    backgroundColor: "#FAFAFA",
    paddingHorizontal: 12,
  },
  currencySymbolSmall: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333333",
    marginRight: 8,
  },
  priceSuggestionTextSmall: {
    fontSize: 14,
    color: "#666666",
    marginTop: 8,
  },
  removeThumbnailButton: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  // Third page image styles
  thirdPageImagesContainer: {
    marginBottom: 20,
  },
  thirdPageImagesScroll: {
    flexDirection: "row",
    marginBottom: 8,
  },
  thirdPageImageWrapper: {
    width: 80,
    height: 80,
    borderRadius: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#EEEEEE",
    overflow: "hidden",
  },
  thirdPageMainImageWrapper: {
    borderColor: "#0066CC",
    borderWidth: 2,
  },
  thirdPageImage: {
    width: "100%",
    height: "100%",
  },
  mainImageBadge: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0, 102, 204, 0.8)",
    paddingVertical: 2,
    alignItems: "center",
  },
  mainImageBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
  },
  // Success page styles
  successContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 20,
  },
  successContent: {
    width: "100%",
    alignItems: "center",
    padding: 20,
  },
  successIconContainer: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333333",
    marginBottom: 16,
    textAlign: "center",
  },
  successMessage: {
    fontSize: 16,
    color: "#666666",
    textAlign: "center",
    marginBottom: 30,
    lineHeight: 24,
  },
  exploreButton: {
    backgroundColor: "#0066CC",
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: "100%",
    alignItems: "center",
  },
  exploreButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
});