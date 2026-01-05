import { useState } from 'react';
import Modal from './Modal';

function CreateChannelModal({ isOpen, onClose, onCreate, showToast }) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isPrivate, setIsPrivate] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            await onCreate(name, description, isPrivate ? 'private' : 'public');
            showToast(`Channel "${name}" created successfully!`, 'success');
            setName('');
            setDescription('');
            setIsPrivate(false);
            onClose();
        } catch (error) {
            showToast(error.response?.data?.error || 'Failed to create channel', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create Channel" size="medium">
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Channel Name *</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        minLength={3}
                        maxLength={255}
                        placeholder="e.g., general, random"
                        autoFocus
                    />
                </div>
                <div className="form-group">
                    <label>Description</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={2}
                        placeholder="What's this channel about?"
                    />
                </div>
                <div className="form-group">
                    <label className="checkbox-label">
                        <input
                            type="checkbox"
                            checked={isPrivate}
                            onChange={(e) => setIsPrivate(e.target.checked)}
                        />
                        <span>Make this channel private</span>
                    </label>
                    <p className="help-text">
                        {isPrivate
                            ? '🔒 Only invited members can see and join this channel'
                            : '# Anyone in the workspace can see and join this channel'}
                    </p>
                </div>
                <div className="modal-actions">
                    <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
                        Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? 'Creating...' : 'Create Channel'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

export default CreateChannelModal;
