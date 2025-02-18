import React from 'react';
import { FaCheck } from 'react-icons/fa';

interface Contact {
  id: string;
  username: string;
  phoneNumber: string;
  email: string; // Updated to required
  avatar: string;
}

interface ContactItemProps {
  contact: Contact;
  isSelected: boolean;
  onToggle: (contact: Contact) => void;
}

const ContactItem: React.FC<ContactItemProps> = ({ contact, isSelected, onToggle }) => {
  return (
    <div
      className="flex items-center justify-between p-4 border-b hover:bg-gray-50 cursor-pointer"
      onClick={() => onToggle(contact)}
    >
      <div className="flex items-center">
        <img
          src={contact.avatar}
          alt={contact.username}
          className="w-12 h-12 rounded-full mr-4"
        />
        <div>
          <h2 className="text-lg font-semibold">{contact.username}</h2>
          <p className="text-sm text-gray-500">{contact.email}</p>
          <p className="text-sm text-gray-500">{contact.phoneNumber}</p>
        </div>
      </div>
      <div>
        {isSelected ? (
          <FaCheck className="text-green-500 w-6 h-6" />
        ) : (
          <div className="w-6 h-6 border-2 border-gray-300 rounded"></div>
        )}
      </div>
    </div>
  );
};

export default ContactItem;
