import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, Edit2, Trash2, ArrowLeft, Eye } from 'lucide-react';
import { useAnnouncementsStore } from '../stores/announcementsStore';
import { RichTextEditor } from '../components/announcements/RichTextEditor';
import { BannerPhotoUpload } from '../components/announcements/BannerPhotoUpload';
import { AnnouncementDetailModal } from '../components/announcements/AnnouncementDetailModal';
import { Button, Input } from '../components/common';
import type { Announcement } from '../types';

type View = 'list' | 'editor';

function getStatus(announcement: Announcement): 'active' | 'scheduled' | 'expired' {
  const today = new Date().toISOString().split('T')[0];
  if (announcement.publish_date > today) return 'scheduled';
  if (announcement.expires_at < today) return 'expired';
  return 'active';
}

const statusConfig = {
  active: { label: 'Activo', className: 'bg-green-100 text-green-800' },
  scheduled: { label: 'Programado', className: 'bg-blue-100 text-blue-800' },
  expired: { label: 'Expirado', className: 'bg-gray-100 text-gray-600' },
};

export function AnnouncementsManagement() {
  const { announcements, isLoading, fetchAll, createAnnouncement, updateAnnouncement, deleteAnnouncement } = useAnnouncementsStore();

  const [view, setView] = useState<View>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [bannerPhoto, setBannerPhoto] = useState<string | null>(null);
  const [publishDate, setPublishDate] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Preview modal
  const [previewAnnouncement, setPreviewAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setBody('');
    setBannerPhoto(null);
    setPublishDate(format(new Date(), 'yyyy-MM-dd'));
    setExpiresAt('');
    setError('');
  };

  const handleNew = () => {
    resetForm();
    setPublishDate(format(new Date(), 'yyyy-MM-dd'));
    setView('editor');
  };

  const handleEdit = (announcement: Announcement) => {
    setEditingId(announcement.id);
    setTitle(announcement.title);
    setBody(announcement.body);
    setBannerPhoto(announcement.banner_photo || null);
    setPublishDate(announcement.publish_date);
    setExpiresAt(announcement.expires_at);
    setError('');
    setView('editor');
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Estás seguro de eliminar este anuncio?')) return;
    try {
      await deleteAnnouncement(id);
    } catch (err) {
      alert('Error al eliminar: ' + String(err));
    }
  };

  const handleSave = async () => {
    setError('');

    if (!title.trim()) {
      setError('El título es obligatorio');
      return;
    }
    if (!body.trim() || body === '<p></p>') {
      setError('El contenido es obligatorio');
      return;
    }
    if (!publishDate) {
      setError('La fecha de publicación es obligatoria');
      return;
    }
    if (!expiresAt) {
      setError('La fecha de expiración es obligatoria');
      return;
    }
    if (expiresAt < publishDate) {
      setError('La fecha de expiración debe ser posterior a la de publicación');
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        await updateAnnouncement(editingId, {
          title,
          body,
          banner_photo: bannerPhoto,
          publish_date: publishDate,
          expires_at: expiresAt,
        });
      } else {
        await createAnnouncement({
          title,
          body,
          banner_photo: bannerPhoto || undefined,
          publish_date: publishDate,
          expires_at: expiresAt,
        });
      }
      setView('list');
      resetForm();
    } catch (err) {
      setError('Error al guardar: ' + String(err));
    } finally {
      setIsSaving(false);
    }
  };

  if (view === 'editor') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setView('list'); resetForm(); }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            {editingId ? 'Editar Anuncio' : 'Nuevo Anuncio'}
          </h1>
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-5">
          <div>
            <label className="label">Imagen de portada</label>
            <BannerPhotoUpload value={bannerPhoto} onChange={setBannerPhoto} />
          </div>

          <Input
            label="Título"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título del anuncio"
            maxLength={500}
          />

          <div>
            <label className="label">Contenido</label>
            <RichTextEditor content={body} onChange={setBody} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              type="date"
              label="Fecha de publicación"
              value={publishDate}
              onChange={(e) => setPublishDate(e.target.value)}
            />
            <Input
              type="date"
              label="Fecha de expiración"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => { setView('list'); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleSave} isLoading={isSaving}>
              {editingId ? 'Guardar Cambios' : 'Publicar Anuncio'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Sección Informativa</h1>
        <Button onClick={handleNew}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Anuncio
        </Button>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-lg shadow p-8">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      ) : announcements.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500">No hay anuncios creados</p>
          <Button onClick={handleNew} className="mt-4">
            <Plus className="w-4 h-4 mr-2" />
            Crear primer anuncio
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Título
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                  Publicación
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                  Expiración
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {announcements.map((announcement) => {
                const status = getStatus(announcement);
                const config = statusConfig[status];

                return (
                  <tr key={announcement.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 truncate max-w-xs">
                        {announcement.title}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 hidden sm:table-cell">
                      {format(parseISO(announcement.publish_date), "d MMM yyyy", { locale: es })}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 hidden sm:table-cell">
                      {format(parseISO(announcement.expires_at), "d MMM yyyy", { locale: es })}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
                        {config.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setPreviewAnnouncement(announcement)}
                          className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                          title="Vista previa"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(announcement)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(announcement.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AnnouncementDetailModal
        isOpen={!!previewAnnouncement}
        onClose={() => setPreviewAnnouncement(null)}
        announcement={previewAnnouncement}
      />
    </div>
  );
}
