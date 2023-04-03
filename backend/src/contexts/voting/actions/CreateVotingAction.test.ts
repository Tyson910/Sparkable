import { Link } from "../../links/domain/models/Link";
import { LinkUuidDto } from "../../links/domain/models/LinkUuidDto";
import { ViewedLinkByUserData } from "../../links/domain/models/ViewedLinkByUserData";
import { ViewedLinkByUserDataRepository } from "../../links/domain/repositories/ViewedLinkByUserDataRepository";
import { LinkRepositoryInMemory } from "../../links/infrastructure/persistence/repositories/LinkRepositoryInMemory";
import { ViewedLinkByUserDataRepositoryInMemory } from "../../links/infrastructure/persistence/repositories/ViewedLinkByUserDataRepositoryInMemory";
import { MandatoryFieldEmptyException } from "../../users/domain/exceptions/MandatoryFieldEmptyException";
import { UserRepositoryInMemory } from "../../users/infrastructure/persistence/repositories/UserRepositoryInMemory";
import { LinkNotOpenedByUserException } from "../domain/exceptions/LinkNotOpenedByUserException";
import { NumberOfVotesExceededException } from "../domain/exceptions/NumberOfVotesExceededException";
import { UserHasNotOpenedAnyLinksException } from "../domain/exceptions/UserHasNotOpenedAnyLinksException";
import { VoteRepositoryInMemory } from "../infrastructure/persistence/repositories/VoteRepositoryInMemory";
import { VotingRepositoryInMemory } from "../infrastructure/persistence/repositories/VotingRepositoryInMemory";
import { CreateVotingAction } from "./CreateVotingAction";

describe('Create voting action', () => {
  let viewedLinkByUserDataRepository: ViewedLinkByUserDataRepository;
  let votingRepository: VotingRepositoryInMemory;
  let voteRepository: VoteRepositoryInMemory
  let createVotingAction: CreateVotingAction;
  let userRepository: UserRepositoryInMemory;
  let linkRepository: LinkRepositoryInMemory;

  beforeEach(async () => {
    viewedLinkByUserDataRepository = new ViewedLinkByUserDataRepositoryInMemory();
    votingRepository = new VotingRepositoryInMemory();
    voteRepository = new VoteRepositoryInMemory();
    userRepository = new UserRepositoryInMemory();
    linkRepository = new LinkRepositoryInMemory();

    createVotingAction = new CreateVotingAction(
      viewedLinkByUserDataRepository,
      votingRepository,
      voteRepository,
      userRepository,
      linkRepository
    );
  });

  test('Cant vote when a user uuid is empty', async () => {
    await expect(createVotingAction.execute('', [])).rejects.toThrow(
      MandatoryFieldEmptyException
    );
  });

  test('Cant vote with more than seven votes', async () => {
    const votes = [
      {linkUuid: 'linkUuid'},
      {linkUuid: 'linkUuid2'},
      {linkUuid: 'linkUuid3'},
      {linkUuid: 'linkUuid4'},
      {linkUuid: 'linkUuid5'},
      {linkUuid: 'linkUuid6'},
      {linkUuid: 'linkUuid7'},
      {linkUuid: 'linkUuid8'}
    ];

    await expect(createVotingAction.execute('userUuid', votes)).rejects.toThrow(
      NumberOfVotesExceededException
    );
  });

  test('Cant vote when a user has not opened any link', async () => {
    await expect(createVotingAction.execute('xxxx', [])).rejects.toThrow(
      UserHasNotOpenedAnyLinksException
    );
  });

  test('Cant vote when user try to vote a link has not opened by him', async () => {
    const userUuid = 'userUuid';
    const linkUuid = 'linkUuid';
    viewedLinkByUserDataRepository.store(new ViewedLinkByUserData(userUuid, linkUuid, 1));
    const votes = [{linkUuid: linkUuid}, {linkUuid: 'linkUuid2'}];

    await expect(createVotingAction.execute(userUuid, votes)).rejects.toThrow(
      LinkNotOpenedByUserException
    );
  });

  test('Voting with an empty selection', async () => {
    const userUuid = 'xxxx';
    viewedLinkByUserDataRepository.store(new ViewedLinkByUserData(userUuid, 'linkUuid', 1));
    const votes: LinkUuidDto[] = [];

    await createVotingAction.execute(userUuid, votes);

    const votings = await votingRepository.getAllVotings();
    expect(votings?.[0].userUuid).toEqual(userUuid);
    expect(votings?.[0].cycle).toEqual(1);
    expect(votings?.[0].countVotes).toEqual(0);

    const voteCollection = await voteRepository.getAllVotes();
    expect(voteCollection).toEqual([]);

    const [ data ] = await viewedLinkByUserDataRepository.getAllData({});
    expect(data[0].voted).toEqual(false);
});

  test('Voting with one selection', async () => {
    const userUuid = 'userUuid';
    const linkUuid = 'linkUuid';
    userRepository.createWithOne(userUuid);
    linkRepository.createOneLink(linkUuid, 'otherUserUuid');
    const cycle = 1;
    viewedLinkByUserDataRepository.store(new ViewedLinkByUserData(userUuid, linkUuid, cycle));
    const votes = [{linkUuid: linkUuid}];

    await createVotingAction.execute(userUuid, votes);

    const votings = await votingRepository.getAllVotings();

    expect(votings?.length).toEqual(1);
    expect(votings?.[0].userUuid).toEqual(userUuid);
    expect(votings?.[0].cycle).toEqual(cycle);
    expect(votings?.[0].countVotes).toEqual(1);

    const voteCollection = await voteRepository.getAllVotes();
    expect(voteCollection?.length).toEqual(1);
    expect(voteCollection?.[0].userUuid).toEqual(userUuid);
    expect(voteCollection?.[0].linkUuid).toEqual(linkUuid);
    expect(voteCollection?.[0].cycle).toEqual(1);
  });

  test('Voting with multiple selection', async () => {
    const userUuid = 'userUuid';
    const linkUuid = 'linkUuid';
    const linkUuidSecond = 'linkUuidSecond';
    userRepository.createWithOne(userUuid);
    linkRepository.createOneLink(linkUuid, 'otherUserUuid');
    linkRepository.createOneLink(linkUuidSecond, 'otherUserUuid');
    viewedLinkByUserDataRepository.store(new ViewedLinkByUserData(userUuid, linkUuid, 1));
    viewedLinkByUserDataRepository.store(new ViewedLinkByUserData(userUuid, linkUuidSecond, 1));

    const votes = [{linkUuid: linkUuid}, {linkUuid: linkUuidSecond}];
    await createVotingAction.execute(userUuid, votes);

    const votesInDatabase = await voteRepository.getAllVotes();
    expect(votesInDatabase?.length).toEqual(2);
    expect(votesInDatabase?.[0].linkUuid).toEqual(linkUuid);
    expect(votesInDatabase?.[1].linkUuid).toEqual(linkUuidSecond);
  });

  test('Ignore the vote if you own the link', async () => {
    const userUuid = 'userUuid';
    const linkUuid = 'linkUuid';
    const linkUuidSecond = 'linkUuidSecond';
    viewedLinkByUserDataRepository.store(new ViewedLinkByUserData(userUuid, linkUuid, 1));
    viewedLinkByUserDataRepository.store(new ViewedLinkByUserData(userUuid, linkUuidSecond, 1));
    userRepository.createWithOne(userUuid);
    linkRepository.createOneLink(linkUuid, userUuid);

    const votes = [{linkUuid: linkUuid}, {linkUuid: linkUuidSecond}];
    await createVotingAction.execute(userUuid, votes);

    const votesInDatabase = await voteRepository.getAllVotes();
    expect(votesInDatabase?.length).toEqual(1);
    expect(votesInDatabase?.[0].linkUuid).toEqual(linkUuidSecond);
  });

});