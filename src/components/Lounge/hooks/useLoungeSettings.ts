import { useState, useEffect } from 'react';
import { captureAndCompressPhoto, streamFileDirectToCloudStorage } from '../../../utils/mediaPipeline';
import { getSessionId } from '../../../utils/auth';

interface UseLoungeSettingsOptions {
  loungeId: string | number;
  loungeDetails: any;
  isParentAdmin: boolean;
  onSuccess?: () => void;
}

export function useLoungeSettings({
  loungeId,
  loungeDetails,
  isParentAdmin,
  onSuccess,
}: UseLoungeSettingsOptions) {
  const [manageTab, setManageTab] = useState<'settings' | 'members' | 'requests' | 'invites'>('settings');
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIconUrl, setEditIconUrl] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [settingsSuccess, setSettingsSuccess] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Sync initial values when loungeDetails change
  useEffect(() => {
    if (loungeDetails) {
      setEditName(loungeDetails.name || loungeDetails.title || '');
      setEditDescription(loungeDetails.description || '');
      setEditIconUrl(loungeDetails.icon_url || loungeDetails.avatar_url || '');
    }
  }, [loungeDetails]);

  const handleSaveSettings = async () => {
    if (!editName.trim()) {
      setSettingsError('Lounge title cannot be empty.');
      return;
    }
    setIsSavingSettings(true);
    setSettingsError('');
    setSettingsSuccess('');
    try {
      const sid = getSessionId();
      const res = await fetch(`/v2/lounges/${loungeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sid}`,
        },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim(),
          icon_url: editIconUrl.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update lounge settings.');
      }

      setSettingsSuccess('updated.');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setSettingsError(err.message || 'Error updating settings.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleIconFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError('');
    if (!e.target.files || e.target.files.length === 0) return;
    setIsUploadingIcon(true);
    try {
      const compressedBlob = await captureAndCompressPhoto(e);
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setEditIconUrl(reader.result);
        }
      };
      reader.readAsDataURL(compressedBlob);

      const uploadedUrl = await streamFileDirectToCloudStorage(compressedBlob, 'avatars', 'webp');
      if (uploadedUrl) {
        setEditIconUrl(uploadedUrl);
      }
    } catch (err: any) {
      console.error('Failed to process/upload lounge icon:', err);
      setUploadError('Failed to upload image. Please ensure file is a valid image (JPEG, PNG, WebP).');
    } finally {
      setIsUploadingIcon(false);
    }
  };

  return {
    manageTab,
    setManageTab,
    editName,
    setEditName,
    editDescription,
    setEditDescription,
    editIconUrl,
    setEditIconUrl,
    settingsError,
    setSettingsError,
    settingsSuccess,
    setSettingsSuccess,
    isSavingSettings,
    isUploadingIcon,
    uploadError,
    handleSaveSettings,
    handleIconFileSelect,
  };
}
