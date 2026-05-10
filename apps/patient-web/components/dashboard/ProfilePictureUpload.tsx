'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { uploadPatientProfilePicture } from '@/components/dashboard/uploadPatientProfilePicture';

export default function ProfilePictureUpload({ userId, currentImageUrl }: { userId: string, currentImageUrl?: string }) {
  const [imageUrl, setImageUrl] = useState(currentImageUrl || '/default-avatar.png');
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const newUrl = await uploadPatientProfilePicture(userId, file);
      setImageUrl(newUrl);
    } catch (error) {
      alert('Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24 rounded-full overflow-hidden border border-gray-200">
        <Image 
          src={imageUrl} 
          alt="Profile Avatar" 
          fill
          className="object-cover"
        />
      </div>
      
      <label className="mt-4 cursor-pointer bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600">
        {isUploading ? 'Uploading...' : 'Change Picture'}
        <input 
          type="file" 
          accept="image/*" 
          className="hidden" 
          onChange={handleFileChange} 
          disabled={isUploading}
        />
      </label>
    </div>
  );
}
