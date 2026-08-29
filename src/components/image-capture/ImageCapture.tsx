import React, { useState } from 'react';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { useIonActionSheet, useIonAlert, useIonToast } from '@ionic/react';
import { cameraOutline, imageOutline, closeOutline } from 'ionicons/icons';

interface ImageCaptureProps {
    /**
     * Trigger element that will open the action sheet (e.g., a Button)
     */
    children: React.ReactElement;
    /**
     * Callback when an image is successfully captured or selected
     */
    onImageCaptured: (photo: Photo) => void;
    /**
     * Optional callback for handling errors
     */
    onError?: (error: any) => void;
    /**
     * Set the quality of the image (1-100)
     * @default 90
     */
    quality?: number;
    /**
     * Whether to allow editing the image after capture
     * @default false
     */
    allowEditing?: boolean;
    /**
     * Determine what result type to return
     * @default CameraResultType.Uri
     */
    resultType?: CameraResultType;
}

const ImageCapture: React.FC<ImageCaptureProps> = ({
    children,
    onImageCaptured,
    onError,
    quality = 90,
    allowEditing = false,
    resultType = CameraResultType.Uri,
}) => {
    const [presentActionSheet] = useIonActionSheet();
    const [presentAlert] = useIonAlert();
    const [presentToast] = useIonToast();

    const [isProcessing, setIsProcessing] = useState(false);

    const checkAndRequestPermission = async (source: CameraSource): Promise<boolean> => {
        try {
            const permissions = await Camera.checkPermissions();

            const permissionType = source === CameraSource.Camera ? 'camera' : 'photos';
            let currentStatus = permissions[permissionType];

            // If permission is already granted, we are good to go
            if (currentStatus === 'granted') {
                return true;
            }

            // If not granted, we request permissions
            const requested = await Camera.requestPermissions({
                permissions: [permissionType],
            });

            currentStatus = requested[permissionType];

            if (currentStatus === 'granted') {
                return true;
            }

            // If still denied, inform user
            presentAlert({
                header: 'Permission Denied',
                message: `Please allow access to your ${permissionType === 'camera' ? 'camera' : 'photo gallery'} in your device settings to use this feature.`,
                buttons: ['OK'],
            });

            return false;
        } catch (error) {
            // Some platforms (like Web) might not implement permissions check
            console.warn('Permission check failed or not implemented on this platform:', error);
            // We assume true and let the actual getPhoto call handle the fallback or error
            return true;
        }
    };

    const handleSelectSource = async (source: CameraSource) => {
        if (isProcessing) return;
        setIsProcessing(true);

        try {
            // 1. Verify permissions
            const hasPermission = await checkAndRequestPermission(source);
            if (!hasPermission) {
                setIsProcessing(false);
                return;
            }

            // 2. Open camera / gallery
            const photo = await Camera.getPhoto({
                quality,
                allowEditing,
                resultType,
                source,
            });

            // 3. Return the photo
            onImageCaptured(photo);
        } catch (error: any) {
            console.error('Error capturing image:', error);
            
            // Check if user just cancelled
            const errorMessage = error?.message || '';
            if (errorMessage.includes('User cancelled') || errorMessage.includes('cancelled')) {
                // Not a real error, just user backing out
                setIsProcessing(false);
                return;
            }

            // Real error handling
            presentToast({
                message: 'Failed to capture or load the image. Please try again.',
                duration: 3000,
                color: 'danger',
            });

            if (onError) {
                onError(error);
            }
        } finally {
            setIsProcessing(false);
        }
    };

    const openActionSheet = () => {
        presentActionSheet({
            header: 'Select Image Source',
            buttons: [
                {
                    text: 'Take Photo',
                    icon: cameraOutline,
                    handler: () => handleSelectSource(CameraSource.Camera),
                },
                {
                    text: 'Choose from Gallery',
                    icon: imageOutline,
                    handler: () => handleSelectSource(CameraSource.Photos),
                },
                {
                    text: 'Cancel',
                    icon: closeOutline,
                    role: 'cancel',
                },
            ],
        });
    };

    // We clone the child element to attach the onClick handler dynamically
    return React.cloneElement(children as React.ReactElement<any>, {
        onClick: (e: any) => {
            // Call the original onClick if it exists
            const childProps = children.props as Record<string, any>;
            if (childProps.onClick) {
                childProps.onClick(e);
            }
            openActionSheet();
        },
    });
};

export default ImageCapture;
