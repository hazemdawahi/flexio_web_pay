import React, { useMemo } from 'react';
import { FaCheck } from 'react-icons/fa';

interface Contact {
  id: string;
  username: string;
  phoneNumber: string;
  email: string;
  avatar?: string;   // support optional avatar
  logo?: string;     // tolerate "logo" key as well
}

interface ContactItemProps {
  contact: Contact;
  onToggleSelection: (contact: Contact) => void;
  /** Draw a divider line under the row */
  showDivider?: boolean;
  /** Parent controls selected state */
  selected?: boolean;
  /** If true => show radio button (multi-select visual) */
  multiSelect?: boolean;
}

const ACCENT = '#00BFFF';

const ContactItem: React.FC<ContactItemProps> = ({
  contact,
  onToggleSelection,
  showDivider = false,
  selected = false,
  multiSelect = false,
}) => {
  const handleClick = () => onToggleSelection(contact);

  const initials = useMemo(() => {
    const n = (contact.username ?? '').trim();
    if (!n) return '?';
    const parts = n.split(/\s+/);
    const a = parts[0]?.[0] ?? '';
    const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
    return (a + b).toUpperCase();
  }, [contact.username]);

  const imgSrc = contact.avatar || contact.logo || '';

  return (
    <>
      <div
        className="flex items-center p-4 bg-white cursor-pointer hover:bg-gray-50 transition"
        onClick={handleClick}
      >
        {/* Avatar / Initials */}
        <div className={`mr-3 ${selected ? 'scale-[1.02]' : ''}`}>
          {imgSrc ? (
            <img
              src={imgSrc}
              alt={contact.username}
              className="w-12 h-12 rounded-full object-cover bg-gray-100"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <span className="text-[15px] font-semibold text-gray-500">
                {initials}
              </span>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex-1 min-h-[48px]">
          <div className="text-[15px] font-semibold truncate">{contact.username}</div>
          <div className="text-[13px] text-gray-500 truncate">{contact.email}</div>
          {!!contact.phoneNumber && (
            <div className="text-[12px] text-gray-500 mt-[2px] truncate">
              {contact.phoneNumber}
            </div>
          )}
        </div>

        {/* Right-side selector */}
        {multiSelect ? (
          // Radio-style indicator
          <div
            className="w-6 h-6 rounded-full border flex items-center justify-center"
            style={{ borderColor: ACCENT }}
            aria-checked={selected}
            role="radio"
          >
            {selected && (
              <div
                className="w-3.5 h-3.5 rounded-full"
                style={{ backgroundColor: ACCENT }}
              />
            )}
          </div>
        ) : (
          // Simple checkmark for single-select contexts
          <div aria-hidden>
            {selected ? (
              <FaCheck className="text-green-500 w-5 h-5" />
            ) : (
              <div className="w-5 h-5 border-2 border-gray-300 rounded" />
            )}
          </div>
        )}
      </div>

      {showDivider && <div className="h-px bg-gray-200 w-full" />}
    </>
  );
};

export default ContactItem;
