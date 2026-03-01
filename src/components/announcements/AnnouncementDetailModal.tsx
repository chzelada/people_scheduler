import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Modal } from '../common';
import type { Announcement } from '../../types';

interface AnnouncementDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  announcement: Announcement | null;
}

export function AnnouncementDetailModal({ isOpen, onClose, announcement }: AnnouncementDetailModalProps) {
  if (!announcement) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={announcement.title} size="lg">
      <div className="space-y-4">
        {announcement.banner_photo && (
          <img
            src={announcement.banner_photo}
            alt={announcement.title}
            className="w-full h-48 object-cover rounded-lg"
          />
        )}
        <p className="text-sm text-gray-500">
          {format(parseISO(announcement.publish_date), "d 'de' MMMM, yyyy", { locale: es })}
        </p>
        <div
          className="announcement-content prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: announcement.body }}
        />
      </div>
    </Modal>
  );
}
