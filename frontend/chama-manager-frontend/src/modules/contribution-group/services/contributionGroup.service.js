import contributionGroupApi from "../api/contributionGroup.api";

const contributionGroupService = {
  async create(payload) {
    const { data } = await contributionGroupApi.create(payload);

    return data.data ?? data.group ?? data;
  },

  async join(payload) {
    const { data } = await contributionGroupApi.join(payload);

    return data.data ?? data.group ?? data;
  },

  async get(id) {
    const { data } = await contributionGroupApi.get(id);

    return data.data ?? data;
  },

  async members(id) {
    const { data } = await contributionGroupApi.getMembers(id);

    return data.data ?? data;
  },
};

export default contributionGroupService;