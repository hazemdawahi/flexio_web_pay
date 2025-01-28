// SendMoneyWithContacts.tsx
import React, { useState, useCallback } from 'react';
import { FaArrowLeft, FaCheck } from 'react-icons/fa';
import { useNavigate } from '@remix-run/react';
import debounce from 'lodash.debounce';
import InfiniteScroll from 'react-infinite-scroll-component';
import { useFetchContactsInfinite } from '~/hooks/useFetchContactsInfinite';
import ContactItem from '~/compoments/ContactItem';

interface Contact {
  id: string;
  username: string;
  phoneNumber: string;
  email?: string; // Optional if not provided by API
  avatar: string; // Mapped from 'logo' in API response
}

const ITEMS_PER_LOAD = 20;

const SendMoneyWithContacts: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([]);

  // Initialize the useFetchContactsInfinite hook
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useFetchContactsInfinite(ITEMS_PER_LOAD, [], searchTerm);

  // Derive all contacts from the fetched pages
  const allContacts: Contact[] = data
    ? data.pages.flatMap((page) =>
        page.data?.content.map((contact: any) => ({
          id: contact.id,
          username: contact.username,
          phoneNumber: contact.phoneNumber,
          email: contact.email || '', // Adjust based on API response
          avatar: contact.logo, // Map 'logo' to 'avatar'
        })) || []
      )
    : [];

  // Handle search with debounce
  const handleSearch = useCallback(
    debounce((term: string) => {
      setSearchTerm(term);
      refetch(); // Refetch data with the new search term
    }, 500),
    [refetch]
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    handleSearch(term);
  };

  // Toggle contact selection
  const toggleSelection = (contact: Contact) => {
    setSelectedContacts((prev) => {
      if (prev.some((c) => c.id === contact.id)) {
        return prev.filter((c) => c.id !== contact.id);
      } else {
        return [...prev, contact];
      }
    });
  };

  // Handle sending money to selected contacts
  const handleSend = () => {
    if (selectedContacts.length === 0) return;
    const userIds = selectedContacts.map((c) => c.id);
    navigate('/users_split', { state: { userIds } });
  };

  return (
    <div className="min-h-screen bg-white p-4 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-700 hover:text-gray-900"
        >
          <FaArrowLeft className="mr-2" size={20} />
          Back
        </button>
      </header>

      {/* Search Bar and Send Button */}
      <div className="flex items-center mb-4">
        <input
          type="text"
          onChange={handleSearchChange}
          placeholder="Search contacts"
          className="flex-grow p-3 border border-gray-300 rounded-l-lg focus:outline-none"
        />
        <button
          onClick={handleSend}
          disabled={selectedContacts.length === 0}
          className={`flex items-center justify-center px-4 py-3 rounded-r-lg text-white ${
            selectedContacts.length > 0
              ? 'bg-green-500 hover:bg-green-600'
              : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          <FaCheck size={16} />
          <span className="ml-2">Send</span>
        </button>
      </div>

      {/* Selected Contacts */}
      {selectedContacts.length > 0 && (
        <div className="mb-4">
          <h2 className="text-xl font-semibold mb-2">Selected Contacts</h2>
          <div className="flex flex-wrap gap-2">
            {selectedContacts.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center bg-green-100 text-green-800 px-3 py-1 rounded-full"
              >
                <img
                  src={contact.avatar}
                  alt={contact.username}
                  className="w-6 h-6 rounded-full mr-2"
                />
                <span className="text-sm">{contact.username}</span>
                <button
                  onClick={() => toggleSelection(contact)}
                  className="ml-2 text-green-600 hover:text-green-800"
                >
                  <FaCheck />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Handling */}
      {isError && (
        <div className="mb-4 text-red-500">
          <p>Error: {error?.message}</p>
          <button onClick={() => refetch()} className="mt-2 text-blue-500 underline">
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="text-center">
          <p>Loading contacts...</p>
        </div>
      )}

      {/* Contacts List with Infinite Scroll */}
      {!isLoading && !isError && (
        <InfiniteScroll
          dataLength={allContacts.length}
          next={fetchNextPage}
          hasMore={!!hasNextPage}
          loader={
            <h4 className="text-center mt-4 text-gray-500">Loading more contacts...</h4>
          }
          endMessage={
            <p className="text-center mt-4 text-gray-500">
              {allContacts.length === 0 ? 'No contacts found.' : 'No more contacts.'}
            </p>
          }
          className="flex-1 overflow-y-auto"
        >
          {allContacts.map((contact) => (
            <ContactItem
              key={contact.id}
              contact={contact}
              isSelected={selectedContacts.some((c) => c.id === contact.id)}
              onToggle={toggleSelection}
            />
          ))}
        </InfiniteScroll>
      )}
    </div>
  );
};

export default SendMoneyWithContacts;
