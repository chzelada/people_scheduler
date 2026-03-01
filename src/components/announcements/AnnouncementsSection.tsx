import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Megaphone } from 'lucide-react';
import { announcementsApi } from '../../services/api';
import { AnnouncementDetailModal } from './AnnouncementDetailModal';
import type { Announcement } from '../../types';

export function AnnouncementsSection() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    const fetchActive = async () => {
      try {
        const data = await announcementsApi.getActive();
        setAnnouncements(data);
      } catch (error) {
        console.error('Error fetching announcements:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchActive();
  }, []);

  if (isLoading) return null;
  if (announcements.length === 0) return null;

  return (
    <>
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center">
          <Megaphone className="w-5 h-5 text-accent-500 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Informativos</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {announcements.map((announcement) => (
              <div key={announcement.id} className="p-5 hover:bg-gray-50 transition-colors">
                {announcement.banner_photo && (
                  <img
                    src={announcement.banner_photo}
                    alt={announcement.title}
                    className="w-full h-36 object-cover rounded-lg mb-3"
                  />
                )}
                <h4 className="font-semibold text-gray-900 mb-1">{announcement.title}</h4>
                <p className="text-xs text-gray-500 mb-2">
                  {format(parseISO(announcement.publish_date), "d 'de' MMMM, yyyy", { locale: es })}
                </p>
                <div
                  className="announcement-content announcement-preview text-sm text-gray-600"
                  dangerouslySetInnerHTML={{ __html: announcement.body }}
                />
                <button
                  onClick={() => setSelectedAnnouncement(announcement)}
                  className="text-sm font-medium text-primary-600 hover:text-primary-800 mt-2"
                >
                  Leer m&aacute;s
                </button>
              </div>
            ))}
        </div>
      </div>

      <AnnouncementDetailModal
        isOpen={!!selectedAnnouncement}
        onClose={() => setSelectedAnnouncement(null)}
        announcement={selectedAnnouncement}
      />
    </>
  );
}
