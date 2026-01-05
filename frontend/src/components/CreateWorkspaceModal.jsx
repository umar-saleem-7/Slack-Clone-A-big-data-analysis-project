import { useState } from 'react';
import Modal from './Modal';

function CreateWorkspaceModal({ isOpen, onClose, onCreate, showToast }) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            await onCreate(name, description);
            showToast('Workspace created successfully!', 'success');
            setName('');
            setDescription('');
            onClose();
        } catch (error) {
            showToast(error.response?.data?.error || 'Failed to create workspace', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create Workspace" size="medium">
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Workspace Name *</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        minLength={3}
                        maxLength={255}
                        placeholder="e.g., My Team"
                        autoFocus
                    />
                </div>
                <div className="form-group">
                    <label>Description</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        placeholder="What's this workspace for?"
                    />
                </div>
                <div className="modal-actions">
                    <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
                        Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? 'Creating...' : 'Create Workspace'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

export default CreateWorkspaceModal;
