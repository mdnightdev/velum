import { useState, useEffect } from 'react';
import { streamFileDirectToCloudStorage } from '../../../utils/mediaPipeline';
import { getSessionId } from '../../../utils/auth';
import { velumToast } from '../../../utils/toast';
import { LoungeSettingsPageId, defaultLoungeSettingsPage } from '../loungeSettingsRoles';

interface UseLoungeSettingsOptions {
  loungeId: string | number;
  loungeDetails: any;
  isParentAdmin: boolean;
  onDetailsUpdated?: (details: any) => void;
}

export function useLoungeSettings({
  loungeId,
  loungeDetails,
  isParentAdmin,
  onDetailsUpdated,
}: UseLoungeSettingsOptions) {
  const [manageTab, setManageTab] = useState<LoungeSettingsPageId>(defaultLoungeSettingsPage('member'));
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIconUrl, setEditIconUrl] = useState('');
  const [editIsPrivate, setEditIsPrivate] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    if (loungeDetails) {
      setEditName(loungeDetails.name || loungeDetails.title || '');
      setEditDescription(loungeDetails.description || '');
      setEditIconUrl(
        loungeDetails.icon_url ||
          loungeDetails.avatar_url ||
          loungeDetails.avatarUrl ||
          loungeDetails.iconUrl ||
          ''
      );
      setEditIsPrivate(!!(loungeDetails.is_private ?? loungeDetails.isPrivate));
    }
  }, [loungeDetails]);

  const handleSaveSettings = async (iconFile?: Blob | null) => {
    if (!editName.trim()) {
      velumToast.error('Lounge name is required.');
      return;
    }
    setIsSavingSettings(true);
    setUploadError('');
    try {
      const previousIconUrl =
        typeof editIconUrl === 'string' && !editIconUrl.startsWith('data:') && !editIconUrl.startsWith('blob:')
          ? editIconUrl.trim()
          : loungeDetails?.avatar_url ||
            loungeDetails?.avatarUrl ||
            loungeDetails?.icon_url ||
            loungeDetails?.iconUrl ||
            '';

      let finalIconUrl = previousIconUrl;
      if (iconFile) {
        try {
          const uploadedUrl = await streamFileDirectToCloudStorage(
            iconFile,
            'avatars',
            iconFile.type.split('/')[1] || 'webp'
          );
          if (!uploadedUrl) {
            throw new Error('Upload returned no URL.');
          }
          finalIconUrl = uploadedUrl;
          setEditIconUrl(uploadedUrl);
        } catch (uploadErr: any) {
          setUploadError(uploadErr?.message || 'Avatar upload failed.');
          throw new Error(uploadErr?.message || 'Failed to save avatar.');
        }
      }

      const sid = getSessionId();
      const body: Record<string, unknown> = {
        name: editName.trim(),
        description: editDescription.trim(),
        is_private: editIsPrivate,
      };
      // Only send icon when we have a real stored URL — never blank out an existing avatar.
      if (finalIconUrl && !String(finalIconUrl).startsWith('data:') && !String(finalIconUrl).startsWith('blob:')) {
        body.icon_url = finalIconUrl;
      }

      const res = await fetch(`/v2/lounges/${loungeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sid}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update lounge settings.');
      }

      const updated = await res.json();
      const nextDetails = updated.lounge || updated;
      onDetailsUpdated?.({
        ...nextDetails,
        avatar_url: nextDetails.avatar_url || nextDetails.avatarUrl || finalIconUrl || previousIconUrl,
        avatarUrl: nextDetails.avatarUrl || nextDetails.avatar_url || finalIconUrl || previousIconUrl,
      });
      velumToast.success('Lounge info saved.');
    } catch (err: any) {
      velumToast.error(err.message || 'Error updating settings.');
      throw err;
    } finally {
      setIsSavingSettings(false);
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
    editIsPrivate,
    setEditIsPrivate,
    settingsError: '',
    settingsSuccess: '',
    isSavingSettings,
    isUploadingIcon: false,
    uploadError,
    setUploadError,
    handleSaveSettings,
  };
}
